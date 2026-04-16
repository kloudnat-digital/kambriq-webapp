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
  buildPaginatedResponse,
  DOWN_PAYMENT_PERCENT,
  EmailService,
  KAMNET_JOBS,
  LandStatus,
  PaginationQuery,
  QUEUES,
  LandReservationStatus,
  SaleCompletedJobPayload,
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
    await this.emailService.send({
      to: dto.clientEmail,
      template: 'clientPortalAccess',
      lang: 'fr',
      args: {
        clientName: dto.clientName,
        landTitle: land.title,
        price: String(land.price),
        agentName: agentUserId, // Will be enriched in controller
      },
    });

    // 8. Notify the agent
    const agentUser = await this.usersService.findById(agentUserId);
    await this.emailService.send({
      to: agentUser.email,
      template: 'reservationCreated',
      lang: agentUser.language || 'fr',
      args: {
        firstName: agentUser.firstName || agentUser.email,
        clientName: dto.clientName,
        landTitle: land.title,
        price: String(land.price),
      },
    });

    this.logger.log('Land reservation created', {
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

  // ----- Admin: Confirm Down Payment ----- //
  async confirmDownPayment(reservationId: string, adminUserId: string) {
    const reservation = await this.findByIdOrThrow(reservationId);

    if (reservation.status !== LandReservationStatus.PENDING) {
      throw new ForbiddenException(this.t('lands.reservation.notPending'));
    }

    if (reservation.downPaymentConfirmed) {
      throw new ConflictException(this.t('lands.reservation.alreadyActive'));
    }

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

    this.logger.log('Reservation down payment confirmed', {
      reservationId,
      adminUserId,
    });

    return updated;
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

    await this.prisma.landReservation.update({
      where: { id: reservationId },
      data: { documentsReceivedAt: new Date(), documentsReceivedBy: adminUserId },
    });

    this.logger.log('Reservation documents received', { reservationId, adminUserId });
    return { message: this.t('lands.reservation.documentsReceived') };
  }

  // ----- Admin: Confirm Remaining Payment (Step 4) ----- //
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

    this.logger.log('Reservation remaining payment confirmed', { reservationId, adminUserId });
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

    this.logger.log('Reservation dossier started', { reservationId, adminUserId });
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

    this.logger.log('Land sale completed', {
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
  async cancel(reservationId: string, userId: string, dto: CancelLandReservationDto) {
    const reservation = await this.findByIdOrThrow(reservationId);

    if (reservation.status === LandReservationStatus.COMPLETED) {
      throw new ForbiddenException('Cannot cancel a completed reservation');
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

    this.logger.log('Reservation cancelled', {
      reservationId,
      landId: reservation.landId,
      reason: dto.reason,
      cancelledBy: userId,
    });

    return { message: this.t('lands.reservation.cancelled') };
  }

  // ----- Get Reservation Detail ----- //
  async findOne(reservationId: string) {
    const reservation = await this.prisma.landReservation.findUnique({
      where: { id: reservationId },
      include: {
        land: {
          include: {
            label: { select: { code: true, name: true } },
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException(this.t('lands.reservation.notFound'));
    }

    return reservation;
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

    return buildPaginatedResponse(reservations, total, page, limit);
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
      },
    });

    if (!reservation) {
      throw new NotFoundException(this.t('lands.reservation.notFound'));
    }
    if (reservation.clientUserId !== clientUserId) {
      throw new ForbiddenException();
    }

    return reservation;
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

    return buildPaginatedResponse(reservations, total, page, limit);
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
            select: { id: true, title: true, price: true, status: true },
          },
        },
      }),
      this.prisma.landReservation.count({ where }),
    ]);

    return buildPaginatedResponse(reservations, total, page, limit);
  }

  // ----- Admin: Invite Client (manual resend) ----- //
  async inviteClient(email: string, firstName: string, lastName: string, phone?: string) {
    const result = await this.usersService.findOrCreateClientUser(
      email,
      firstName,
      lastName,
      phone,
    );

    this.logger.log(`Client invite ${result.isNew ? 'sent' : 'resent'}`, { email });

    return {
      clientUserId: result.id,
      email: result.email,
      isNew: result.isNew,
    };
  }

  // ----- Private Helpers ----- //

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
}
