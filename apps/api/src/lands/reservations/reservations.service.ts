import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LandsPrismaService } from '../prisma/lands-prisma.service';
import { UsersService } from '../../core/users/users.service';
import {
  CreateLandReservationDto,
  CancelLandReservationDto,
  LandReservationFilterDto,
} from '../dto/lands.dto';
import {
  DOWN_PAYMENT_PERCENT,
  EmailService,
  KAMNET_JOBS,
  LandClientDocumentType,
  LandReservationStatus,
  LandStatus,
  PaginationQuery,
  PaymentState,
  QUEUES,
  SaleCompletedJobPayload,
  StorageService,
  buildPaginatedResponse,
  maskEmail,
} from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';

/** * *
 * 1. CREATE: Agent reserves a land for a client
 *    - Validates land is AVAILABLE + published
 *    - Creates reservation record + updates land status to RESERVED
 *    - Creates/fetches client user in Core (for portal access)
 *    - Sends portal access email to client
 *    - All within a DB transaction (atomic)
 *
 * 2. CONFIRM: Admin confirms down payment received
 *    - Updates reservation + notifies agent + client
 *
 * 3. COMPLETE: Sale finalized
 *    - Land status -> SOLD, reservation -> COMPLETED
 *
 * 4. CANCEL: Agent or admin cancels
 *    - Land status -> AVAILABLE, reservation -> CANCELLED
 *
 * Concurrency control:
 * - Uses DB transaction with row-level check to prevent double-booking
 * - If two agents reserve the same land simultaneously, one gets HTTP 409
 */
@Injectable()
export class LandReservationsService {
  private readonly logger = new Logger(LandReservationsService.name);

  constructor(
    private readonly prisma: LandsPrismaService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly storageService: StorageService,
    private readonly i18n: I18nService,
    @InjectQueue(QUEUES.KAMNET) private readonly kamnetQueue: Queue<SaleCompletedJobPayload>,
  ) {}

  // ----- Create Reservation ----- //
  // The core flow: agent picks a land, enters client details,
  // system atomically marks land as reserved.
  async create(agentUserId: string, dto: CreateLandReservationDto) {
    // Use a transaction to prevent race conditions.
    // Inside the transaction: check land is still available, then reserve.
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Fetch land with a fresh read inside the transaction
      const land = await tx.land.findUnique({
        where: { id: dto.landId },
        include: { label: true },
      });

      if (!land) {
        throw new NotFoundException(this.t('lands.land.notFound'));
      }

      if (!land.isPublished) {
        throw new ForbiddenException(this.t('lands.land.notPublished'));
      }

      if (land.status !== LandStatus.AVAILABLE) {
        throw new ConflictException(this.t('lands.reservation.conflict'));
      }

      // 2. Check no active reservation exists for this land
      const existingReservation = await tx.landReservation.findFirst({
        where: {
          landId: dto.landId,
          status: { notIn: [LandReservationStatus.CANCELLED] },
        },
      });

      if (existingReservation) {
        throw new ConflictException(this.t('lands.reservation.conflict'));
      }

      // 3. Calculate down payment (5% of land price)
      const downPaymentAmount = Math.round((land.price * DOWN_PAYMENT_PERCENT) / 100);

      // 4. Create the reservation
      const reservation = await tx.landReservation.create({
        data: {
          landId: dto.landId,
          agentUserId,
          clientName: dto.clientName,
          clientEmail: dto.clientEmail,
          clientPhone: dto.clientPhone || null,
          status: LandReservationStatus.PENDING,
          downPaymentAmount,
        },
      });

      // 5. Update land status to RESERVED
      await tx.land.update({
        where: { id: dto.landId },
        data: { status: LandStatus.RESERVED },
      });

      return { reservation, land };
    });

    const { reservation, land } = result;

    // 6. Create or fetch client user in Core (outside the LANDS transaction)
    // This gives the client portal access to track their purchase.
    const nameParts = dto.clientName.trim().split(/\s+/);
    const firstName = nameParts[0] || dto.clientName;
    const lastName = nameParts.slice(1).join(' ') || '';

    const clientUser = await this.usersService.findOrCreateClientUser(
      dto.clientEmail,
      firstName,
      lastName,
      dto.clientPhone,
    );

    // Update reservation with client user ID
    await this.prisma.landReservation.update({
      where: { id: reservation.id },
      data: { clientUserId: clientUser.id },
    });

    // 7. Send client portal access email
    // Resolves the agent's name prior to sending the email to ensure the client
    // receives the correct human-readable name instead of the raw UUID.
    const agentUser = await this.usersService.findById(agentUserId);
    const agentName = [agentUser.firstName, agentUser.lastName].filter(Boolean).join(' ').trim();

    await this.emailService.send({
      to: dto.clientEmail,
      template: 'clientPortalAccess',
      lang: 'fr',
      args: {
        clientName: dto.clientName,
        landTitle: land.title,
        price: String(land.price),
        // Empty rather than an id: the template omits the line when there is no
        // name, which is the only honest option if the name cannot be reached.
        agentName,
      },
    });

    // 8. Notify the agent
    await this.emailService.sendUpdate(
      {
        to: agentUser.email,
        template: 'reservationCreated',
        lang: agentUser.language || 'fr',
        args: {
          firstName: agentUser.firstName || agentUser.email,
          clientName: dto.clientName,
          landTitle: land.title,
          price: String(land.price),
        },
      },
      agentUser.profile,
    );

    this.logger.log('Land reservation created %o', {
      reservationId: reservation.id,
      landId: dto.landId,
      agentUserId,
      clientUserId: clientUser.id,
      isNewClient: clientUser.isNew,
    });

    return {
      ...reservation,
      clientUserId: clientUser.id,
      downPaymentAmount: reservation.downPaymentAmount,
      land: {
        id: land.id,
        title: land.title,
        price: land.price,
        label: land.label.code,
      },
    };
  }

  // ----- Admin: Confirm Down Payment (Step 2) ----- //
  /**
   * Admin step 2: record that the down payment (acompte) was received.
   *
   * This step is a downstream projection of the payment ledger. It relies on
   * `assertAcompteIsValidated` to ensure the payment has been formally validated
   * by `ADMIN_GLOBAL` in `PaymentsService` prior to advancing the reservation state.
   *
   * The fields `confirmedBy` and `confirmedAt` record the actor who advanced
   * the reservation, which is distinctly tracked separately from the payment validation.
   */
  async confirmDownPayment(reservationId: string, adminUserId: string) {
    const reservation = await this.findByIdOrThrow(reservationId);

    if (reservation.status !== LandReservationStatus.PENDING) {
      throw new ForbiddenException(this.t('lands.reservation.notPending'));
    }

    if (reservation.downPaymentConfirmed) {
      throw new ConflictException(this.t('lands.reservation.alreadyActive'));
    }

    await this.assertAcompteIsValidated(reservationId);

    const updated = await this.prisma.landReservation.update({
      where: { id: reservationId },
      data: {
        status: LandReservationStatus.CONFIRMED,
        downPaymentConfirmed: true,
        confirmedBy: adminUserId,
        confirmedAt: new Date(),
      },
    });

    // Notify client and agent
    await this.emailService.send({
      to: reservation.clientEmail,
      template: 'reservationConfirmed',
      lang: 'fr',
      args: {
        firstName: reservation.clientName,
        reservationId: reservationId.substring(0, 8),
      },
    });

    this.logger.log('Reservation down payment confirmed %o', {
      reservationId,
      adminUserId,
    });

    return updated;
  }

  /**
   * Validates that at least one payment associated with the reservation has reached `VALIDE` state.
   * `PARTIELLEMENT_RECU` is insufficient to satisfy the down payment requirement.
   * Errors include detailed state of existing payments to guide operator action.
   */
  private async assertAcompteIsValidated(reservationId: string): Promise<void> {
    const payments = await this.prisma.payment.findMany({
      where: { reservationId },
      select: { reference: true, state: true },
    });

    if (payments.some((payment) => payment.state === PaymentState.VALIDE)) return;

    throw new ForbiddenException(
      this.t('lands.reservation.acompteNotValidated', 'fr', {
        payments: payments.length
          ? payments.map((p) => `${p.reference ?? '?'} (${p.state})`).join(', ')
          : '-',
      }),
    );
  }

  // ----- Admin: Mark Client Documents Received (Step 3) ----- //
  async markDocumentsReceived(reservationId: string, adminUserId: string) {
    const reservation = await this.findByIdOrThrow(reservationId);

    if (!reservation.downPaymentConfirmed) {
      throw new ForbiddenException(this.t('lands.reservation.previousStepRequired'));
    }
    if (reservation.documentsReceivedAt) {
      throw new ConflictException(this.t('lands.reservation.stepAlreadyDone'));
    }

    const present = await this.prisma.landClientDocument.findMany({
      where: { reservationId, deletedAt: null },
      select: { type: true },
    });

    const types = new Set(present.map((d) => d.type));
    const allUploaded = LandReservationsService.REQUIRED_CLIENT_DOC_TYPES.every((t) =>
      types.has(t),
    );

    if (!allUploaded) {
      throw new ForbiddenException(this.t('lands.reservation.clientDocsMissing'));
    }

    await this.prisma.landReservation.update({
      where: { id: reservationId },
      data: { documentsReceivedAt: new Date(), documentsReceivedBy: adminUserId },
    });

    await this.notifyClientStep(reservation, 'clientDocumentsValidated');

    this.logger.log('Reservation documents received %o', { reservationId, adminUserId });
    return { message: this.t('lands.reservation.documentsReceived') };
  }

  // ----- Admin: Confirm Remaining Payment (Step 4) ----- //
  /**
   * Admin step 4: record that the balance was received.
   *
   * Currently updates the reservation state independently of the payment ledger.
   * This is a known architectural gap, as secondary balance payments are not yet modeled
   * in the `Payment` ledger.
   */
  async confirmRemainingPayment(reservationId: string, adminUserId: string) {
    const reservation = await this.findByIdOrThrow(reservationId);

    if (!reservation.documentsReceivedAt) {
      throw new ForbiddenException(this.t('lands.reservation.previousStepRequired'));
    }
    if (reservation.remainingPaymentConfirmedAt) {
      throw new ConflictException(this.t('lands.reservation.stepAlreadyDone'));
    }

    await this.prisma.landReservation.update({
      where: { id: reservationId },
      data: { remainingPaymentConfirmedAt: new Date(), remainingPaymentConfirmedBy: adminUserId },
    });

    await this.notifyClientStep(reservation, 'paymentConfirmed');

    this.logger.log('Reservation remaining payment confirmed %o', { reservationId, adminUserId });
    return { message: this.t('lands.reservation.remainingPaymentConfirmed') };
  }

  // ----- Admin: Start Dossier / Title Transfer (Step 5) ----- //
  async startDossier(reservationId: string, adminUserId: string) {
    const reservation = await this.findByIdOrThrow(reservationId);

    if (!reservation.remainingPaymentConfirmedAt) {
      throw new ForbiddenException(this.t('lands.reservation.previousStepRequired'));
    }
    if (reservation.dossierStartedAt) {
      throw new ConflictException(this.t('lands.reservation.stepAlreadyDone'));
    }

    await this.prisma.landReservation.update({
      where: { id: reservationId },
      data: { dossierStartedAt: new Date(), dossierStartedBy: adminUserId },
    });

    await this.notifyClientStep(reservation, 'dossierStarted');

    this.logger.log('Reservation dossier started %o', { reservationId, adminUserId });
    return { message: this.t('lands.reservation.dossierStarted') };
  }

  // ----- Admin: Complete Sale ----- //
  async complete(reservationId: string, adminUserId: string) {
    const reservation = await this.findByIdOrThrow(reservationId);

    if (reservation.status !== LandReservationStatus.CONFIRMED) {
      throw new ForbiddenException(this.t('lands.reservation.notConfirmed'));
    }

    // Atomically: update reservation + mark land as SOLD
    await this.prisma.$transaction([
      this.prisma.landReservation.update({
        where: { id: reservationId },
        data: {
          status: LandReservationStatus.COMPLETED,
          completedAt: new Date(),
        },
      }),
      this.prisma.land.update({
        where: { id: reservation.landId },
        data: { status: LandStatus.SOLD },
      }),
    ]);

    this.logger.log('Land sale completed %o', {
      reservationId,
      landId: reservation.landId,
      adminUserId,
    });

    // Notify KAMNET asynchronously: increment agent's sales count
    // and check if they qualify for a promotion (JUNIOR -> CONFIRMED -> MANAGER).
    await this.kamnetQueue.add(KAMNET_JOBS.SALE_COMPLETED, {
      agentUserId: reservation.agentUserId,
      landId: reservation.landId,
      reservationId,
    });

    return { message: this.t('lands.reservation.completed') };
  }

  // ----- Cancel Reservation ----- //
  async cancel(
    reservationId: string,
    userId: string,
    dto: CancelLandReservationDto,
    opts?: { enforceOwnership?: boolean },
  ) {
    const reservation = await this.findByIdOrThrow(reservationId);

    if (opts?.enforceOwnership && reservation.agentUserId !== userId) {
      throw new ForbiddenException(this.t('lands.reservation.notOwner'));
    }

    if (reservation.status === LandReservationStatus.COMPLETED) {
      throw new ForbiddenException(this.t('lands.reservation.alreadyCompleted'));
    }

    // Cancel reservation + make land available again
    await this.prisma.$transaction([
      this.prisma.landReservation.update({
        where: { id: reservationId },
        data: {
          status: LandReservationStatus.CANCELLED,
          cancelReason: dto.reason,
          cancelledAt: new Date(),
        },
      }),
      this.prisma.land.update({
        where: { id: reservation.landId },
        data: { status: LandStatus.AVAILABLE },
      }),
    ]);

    // Notify agent
    const land = await this.prisma.land.findUnique({
      where: { id: reservation.landId },
    });

    await this.emailService.send({
      to: reservation.clientEmail,
      template: 'reservationCancelled',
      lang: 'fr',
      args: {
        firstName: reservation.clientName,
        landTitle: land?.title || 'N/A',
        reason: dto.reason,
      },
    });

    this.logger.log('Reservation cancelled %o', {
      reservationId,
      landId: reservation.landId,
      reason: dto.reason,
      cancelledBy: userId,
    });

    return { message: this.t('lands.reservation.cancelled') };
  }

  /**
   * Retrieves a specific reservation with agent ownership enforcement.
   * Prevents unauthorized access to client identity documents by scoping to the requesting agent.
   */
  async findOneForAgent(agentUserId: string, reservationId: string) {
    const reservation = await this.prisma.landReservation.findUnique({
      where: { id: reservationId },
      include: {
        land: {
          include: {
            label: { select: { code: true, name: true } },
          },
        },
        landClientDocuments: { where: { deletedAt: null } },
      },
    });

    if (!reservation) {
      throw new NotFoundException(this.t('lands.reservation.notFound'));
    }

    // Refused before the presigning below, which is the step that would hand out
    // readable links to the documents.
    if (reservation.agentUserId !== agentUserId) {
      throw new ForbiddenException(this.t('lands.reservation.notOwner'));
    }

    // Generate presigned download URLs for client-uploaded documents.
    const clientDocumentsWithUrls = await Promise.all(
      reservation.landClientDocuments.map(async (d) => ({
        ...d,
        downloadUrl: await this.storageService.getDownloadUrl(d.url),
      })),
    );

    // Slot-by-type view (same shape as findOneForClient) so admin/agent UI can
    // render a card per required type without duplicating the requirement list.
    const requiredDocuments = LandReservationsService.REQUIRED_CLIENT_DOC_TYPES.map((type) => {
      const document = clientDocumentsWithUrls.find((d) => d.type === type) ?? null;
      return { type, uploaded: !!document, document };
    });

    return {
      ...reservation,
      currentStep: this.computeStep(reservation),
      clientDocuments: clientDocumentsWithUrls,
      requiredDocuments,
    };
  }

  // ----- Agent: My Reservations ----- //
  async findByAgent(
    agentUserId: string,
    query: PaginationQuery,
    filters?: LandReservationFilterDto,
  ) {
    const { page, limit, sort, order } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { agentUserId };
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { clientName: { contains: filters.search, mode: 'insensitive' } },
        { clientEmail: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [reservations, total] = await this.prisma.$transaction([
      this.prisma.landReservation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort || 'createdAt']: order || 'desc' },
        include: {
          land: {
            select: { id: true, title: true, price: true, status: true },
          },
        },
      }),
      this.prisma.landReservation.count({ where }),
    ]);

    const mapped = reservations.map((reservation) => ({
      ...reservation,
      currentStep: this.computeStep(reservation),
    }));
    return buildPaginatedResponse(mapped, total, page, limit);
  }

  // ----- Client: Single Purchase Detail ----- //
  async findOneForClient(clientUserId: string, reservationId: string) {
    const reservation = await this.prisma.landReservation.findUnique({
      where: { id: reservationId },
      include: {
        land: {
          select: {
            id: true,
            title: true,
            region: true,
            city: true,
            price: true,
            sizeM2: true,
            label: { select: { code: true, name: true } },
            documents: {
              where: { isPrivate: false },
              select: { id: true, name: true, type: true, url: true },
            },
          },
        },
        landClientDocuments: { where: { deletedAt: null } },
      },
    });

    if (!reservation) {
      throw new NotFoundException(this.t('lands.reservation.notFound'));
    }
    if (reservation.clientUserId !== clientUserId) {
      throw new ForbiddenException();
    }

    // Generate presigned download URLs for KAMBRIQ-provided documents.
    const documentsWithUrls = await Promise.all(
      reservation.land.documents.map(async (d) => ({
        ...d,
        downloadUrl: await this.storageService.getDownloadUrl(d.url),
      })),
    );

    // Generate presigned download URLs for client-uploaded documents.
    const clientDocumentsWithUrls = await Promise.all(
      reservation.landClientDocuments.map(async (d) => ({
        ...d,
        downloadUrl: await this.storageService.getDownloadUrl(d.url),
      })),
    );

    // Slot-by-type view so the UI can render a card per required type without
    // duplicating the requirement list on the frontend.
    const requiredDocuments = LandReservationsService.REQUIRED_CLIENT_DOC_TYPES.map((type) => {
      const document = clientDocumentsWithUrls.find((d) => d.type === type) ?? null;
      return { type, uploaded: !!document, document };
    });

    // Attach agent details (firstName, lastName, email, phone) from Core users.
    const [enriched] = await this.attachAgents([reservation]);

    return {
      ...enriched,
      currentStep: this.computeStep(reservation),
      land: {
        ...enriched.land,
        documents: documentsWithUrls,
      },
      clientDocuments: clientDocumentsWithUrls,
      requiredDocuments,
    };
  }

  // ----- Client: My Purchases ----- //
  async findByClient(clientUserId: string, query: PaginationQuery) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [reservations, total] = await this.prisma.$transaction([
      this.prisma.landReservation.findMany({
        where: { clientUserId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          land: {
            select: {
              id: true,
              title: true,
              region: true,
              city: true,
              price: true,
              sizeM2: true,
              label: { select: { code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.landReservation.count({ where: { clientUserId } }),
    ]);

    const mapped = reservations.map((r) => ({ ...r, currentStep: this.computeStep(r) }));
    const enriched = await this.attachAgents(mapped);
    return buildPaginatedResponse(enriched, total, page, limit);
  }

  // ----- Admin: All Reservations ----- //
  async findAll(query: PaginationQuery, filters?: LandReservationFilterDto) {
    const { page, limit, sort, order } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.agentUserId) where.agentUserId = filters.agentUserId;
    if (filters?.search) {
      where.OR = [
        { clientName: { contains: filters.search, mode: 'insensitive' } },
        { clientEmail: { contains: filters.search, mode: 'insensitive' } },
        { landId: { contains: filters.search } },
      ];
    }

    const [reservations, total] = await this.prisma.$transaction([
      this.prisma.landReservation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort || 'createdAt']: order || 'desc' },
        include: {
          land: {
            select: {
              id: true,
              title: true,
              price: true,
              status: true,
              sizeM2: true,
              label: { select: { code: true } },
            },
          },
        },
      }),
      this.prisma.landReservation.count({ where }),
    ]);

    const mapped = reservations.map((reservation) => ({
      ...reservation,
      currentStep: this.computeStep(reservation),
    }));
    return buildPaginatedResponse(mapped, total, page, limit);
  }

  // ----- Admin: Invite Client (manual resend) ----- //
  async inviteClient(email: string, firstName: string, lastName: string, phone?: string) {
    const result = await this.usersService.findOrCreateClientUser(
      email,
      firstName,
      lastName,
      phone,
    );

    this.logger.log(`Client invite ${result.isNew ? 'sent' : 'resent'} %o`, {
      email: maskEmail(email),
    });

    return {
      clientUserId: result.id,
      email: result.email,
      isNew: result.isNew,
    };
  }

  async getClientDocumentUploadUrl(
    clientUserId: string,
    reservationId: string,
    dto: {
      type: LandClientDocumentType;
      filename: string;
      contentType: string;
    },
  ) {
    const reservation = await this.findReservationForClientOrThrow(clientUserId, reservationId);
    this.assertCanUploadClientDocs(reservation);

    const timestamp = Date.now();
    const safeName = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = this.storageService.buildKey(
      'lands',
      'client-documents',
      reservationId,
      `${dto.type}-${timestamp}-${safeName}`,
    );

    return this.storageService.getUploadUrl(key, dto.contentType);
  }

  async registerClientDocument(
    clientUserId: string,
    reservationId: string,
    dto: {
      type: LandClientDocumentType;
      url: string;
      name: string;
    },
  ) {
    const reservation = await this.findReservationForClientOrThrow(clientUserId, reservationId);
    this.assertCanUploadClientDocs(reservation);

    // Soft-delete any active doc of the same type, then insert a fresh row.
    // Multiple historical rows per (reservationId, type) are preserved for audit.
    const document = await this.prisma.$transaction(async (tx) => {
      await tx.landClientDocument.updateMany({
        where: { reservationId, type: dto.type, deletedAt: null },
        data: { deletedAt: new Date(), deletedBy: clientUserId },
      });
      return tx.landClientDocument.create({
        data: {
          reservationId,
          type: dto.type,
          url: dto.url,
          name: dto.name,
          uploadedBy: clientUserId,
        },
      });
    });

    await this.notifyAgentDocumentUploaded(reservation, dto.type);

    return document;
  }

  // ----- Client: Delete own document (soft) -----
  async deleteClientDocument(clientUserId: string, reservationId: string, documentId: string) {
    const reservation = await this.findReservationForClientOrThrow(clientUserId, reservationId);
    this.assertCanUploadClientDocs(reservation);

    const document = await this.prisma.landClientDocument.findFirst({
      where: { id: documentId, reservationId, deletedAt: null },
    });
    if (!document) {
      throw new NotFoundException(this.t('lands.reservation.docNotFound'));
    }

    await this.prisma.landClientDocument.update({
      where: { id: documentId },
      data: { deletedAt: new Date(), deletedBy: clientUserId },
    });

    this.logger.log('Client document deleted by client %o', {
      reservationId,
      documentId,
      clientUserId,
    });
    return { message: this.t('lands.reservation.docDeleted') };
  }

  // ----- Admin: Reject a client document -----
  async rejectClientDocument(
    adminUserId: string,
    reservationId: string,
    documentId: string,
    reason: string,
  ) {
    const reservation = await this.findByIdOrThrow(reservationId);

    const document = await this.prisma.landClientDocument.findFirst({
      where: { id: documentId, reservationId, deletedAt: null },
    });
    if (!document) {
      throw new NotFoundException(this.t('lands.reservation.docNotFound'));
    }

    // If docs were already validated, rejection reopens step 3.
    const reopenStep =
      reservation.documentsReceivedAt !== null
        ? [
            this.prisma.landReservation.update({
              where: { id: reservationId },
              data: { documentsReceivedAt: null, documentsReceivedBy: null },
            }),
          ]
        : [];

    await this.prisma.$transaction([
      this.prisma.landClientDocument.update({
        where: { id: documentId },
        data: {
          deletedAt: new Date(),
          deletedBy: adminUserId,
          rejectionReason: reason,
        },
      }),
      ...reopenStep,
    ]);

    await this.notifyClientDocumentRejected(reservation, document.type, reason);

    this.logger.log('Client document rejected by admin %o', {
      reservationId,
      documentId,
      adminUserId,
      reason,
    });
    return { message: this.t('lands.reservation.docRejected') };
  }

  // ----- Private Helpers ----- //

  private static readonly REQUIRED_CLIENT_DOC_TYPES = [
    LandClientDocumentType.ID_CARD,
    LandClientDocumentType.PROOF_OF_ADDRESS,
  ];

  // Block uploads when the reservation is no longer in a state to receive docs.
  // Past states: cancelled, completed, or docs already validated by admin.
  private assertCanUploadClientDocs(reservation: {
    status: LandReservationStatus;
    documentsReceivedAt: Date | null;
  }) {
    if (
      reservation.status === LandReservationStatus.CANCELLED ||
      reservation.status === LandReservationStatus.COMPLETED ||
      reservation.documentsReceivedAt
    ) {
      throw new ForbiddenException(this.t('lands.reservation.cannotUploadDocs'));
    }
  }

  private async findReservationForClientOrThrow(clientUserId: string, reservationId: string) {
    const reservation = await this.prisma.landReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException(this.t('lands.reservation.notFound'));
    }

    if (reservation.clientUserId !== clientUserId) {
      throw new ForbiddenException();
    }

    return reservation;
  }

  private async findByIdOrThrow(reservationId: string) {
    const reservation = await this.prisma.landReservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) {
      throw new NotFoundException(this.t('lands.reservation.notFound'));
    }
    return reservation;
  }

  private t(key: string, lang = 'fr', args?: Record<string, unknown>): string {
    return this.i18n.translate(key, { lang, args }) as string;
  }

  // ----- Email notification helpers -----
  // Fire-and-forget: failures are logged but never break the API response.

  private docTypeLabel(type: LandClientDocumentType, lang: string): string {
    const labels: Record<string, Record<string, string>> = {
      en: {
        ID_CARD: 'ID card',
        PROOF_OF_ADDRESS: 'proof of address',
        OTHER: 'document',
      },
      fr: {
        ID_CARD: "pièce d'identité",
        PROOF_OF_ADDRESS: 'justificatif de domicile',
        OTHER: 'document',
      },
    };
    return labels[lang]?.[type] ?? type;
  }

  private async notifyAgentDocumentUploaded(
    reservation: { agentUserId: string; clientName: string; landId: string },
    docType: LandClientDocumentType,
  ): Promise<void> {
    try {
      const [agent, land] = await Promise.all([
        this.usersService.findById(reservation.agentUserId).catch(() => null),
        this.prisma.land.findUnique({ where: { id: reservation.landId } }),
      ]);
      if (!agent || !land) return;

      const lang = agent.language || 'fr';
      await this.emailService.sendUpdate(
        {
          to: agent.email,
          template: 'clientDocumentUploaded',
          lang,
          args: {
            firstName: agent.firstName || agent.email,
            clientName: reservation.clientName,
            landTitle: land.title,
            docType: this.docTypeLabel(docType, lang),
          },
        },
        agent.profile,
      );
    } catch (error) {
      this.logger.warn('clientDocumentUploaded email failed %o', { error });
    }
  }

  /**
   * Resolves the client's language preference, defaulting to French upon lookup failure.
   * A resilient lookup is intentionally maintained to ensure transactional emails are always
   * dispatched even if the core preference lookup fails.
   */
  private async resolveClientLang(clientUserId: string | null): Promise<string> {
    if (!clientUserId) return 'fr';
    const user = await this.usersService.findById(clientUserId).catch(() => null);
    return user?.language || 'fr';
  }

  private async notifyClientStep(
    reservation: {
      clientUserId: string | null;
      clientName: string;
      clientEmail: string;
      landId: string;
    },
    template: 'clientDocumentsValidated' | 'paymentConfirmed' | 'dossierStarted',
  ): Promise<void> {
    try {
      const [land, lang] = await Promise.all([
        this.prisma.land.findUnique({ where: { id: reservation.landId } }),
        this.resolveClientLang(reservation.clientUserId),
      ]);
      if (!land) return;

      // `send`, not `sendUpdate`. All three templates this method carries -
      // clientDocumentsValidated, paymentConfirmed, dossierStarted - tell a
      // client that their purchase moved. `paymentConfirmed` is money. A
      // notification preference does not get to suppress any of them, and
      // `sendUpdate` now throws if asked to.
      await this.emailService.send({
        to: reservation.clientEmail,
        template,
        lang,
        args: {
          clientName: reservation.clientName,
          landTitle: land.title,
        },
      });
    } catch (error) {
      this.logger.warn(`${template} email failed %o`, { error });
    }
  }

  private async notifyClientDocumentRejected(
    reservation: {
      clientUserId: string | null;
      clientName: string;
      clientEmail: string;
      landId: string;
    },
    docType: LandClientDocumentType,
    reason: string,
  ): Promise<void> {
    try {
      const [land, lang] = await Promise.all([
        this.prisma.land.findUnique({ where: { id: reservation.landId } }),
        this.resolveClientLang(reservation.clientUserId),
      ]);
      if (!land) return;

      await this.emailService.send({
        to: reservation.clientEmail,
        template: 'clientDocumentRejected',
        lang,
        args: {
          clientName: reservation.clientName,
          landTitle: land.title,
          docType: this.docTypeLabel(docType, lang),
          reason,
        },
      });
    } catch (error) {
      this.logger.warn('clientDocumentRejected email failed %o', { error });
    }
  }

  private async attachAgents<T extends { agentUserId: string }>(reservations: T[]) {
    const ids = [...new Set(reservations.map((r) => r.agentUserId))];
    const users = await this.usersService.findManyByIds(ids);
    const byId = new Map(users.map((u) => [u.id, u]));

    return reservations.map((r) => {
      const user = byId.get(r.agentUserId);
      return {
        ...r,
        agent: user,
      };
    });
  }

  private computeStep(reservation: {
    status: LandReservationStatus;
    confirmedAt: Date | null;
    documentsReceivedAt: Date | null;
    remainingPaymentConfirmedAt: Date | null;
    dossierStartedAt: Date | null;
    completedAt: Date | null;
  }): number {
    if (reservation.status === LandReservationStatus.CANCELLED) return 0;
    if (reservation.completedAt) return 6;
    if (reservation.dossierStartedAt) return 5;
    if (reservation.remainingPaymentConfirmedAt) return 4;
    if (reservation.documentsReceivedAt) return 3;
    if (reservation.confirmedAt) return 2;
    return 1;
  }
}
