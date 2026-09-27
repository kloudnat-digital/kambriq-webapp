import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  buildPaginatedResponse,
  EmailService,
  formatHumanDate,
  formatMoney,
  IdVerificationStatus,
  PaginationQuery,
  RoleCode,
  StorageService,
} from '@kambriq/common';
import {
  buildReference,
  assertActorIsNamed,
  assertTransitionAllowed,
  assertTransitionIsDeliberate,
  assertTransitionIsEvidenced,
  COMMITTING_STATES,
  PaymentChannel,
  PaymentState,
  RECORDABLE_CHANNELS,
  SELECTABLE_CHANNELS,
  channelLabel,
  requiresPaidBy,
  sumReceipts,
  PaymentPurpose,
  ageInDays,
  withOldestWaiting,
} from '@kambriq/common';
import { ConfigService } from '@nestjs/config';
import { CorePrismaService } from '../../core/prisma/core-prisma.service';
import { LandsPrismaService } from '../prisma/lands-prisma.service';
import { PaymentChannelsService } from './payment-channels.service';

/**
 * G1 - the payment state machine and the movement ledger.
 *
 * Specification: `ops_kambriq_paiement-hybride_v01.md`. Overview and transition
 * table: `docs/ops/g1-payment-model.md`.
 *
 * **Recording money and agreeing that it settles a payment are two calls.**
 * `recordReceipt` appends to the ledger and changes no state.
 * `transition` changes state and moves no money. The old
 * `confirmDownPayment` did both in one `update`, which is how a payment becomes
 * settled because somebody typed an amount.
 */
export type RecordReceiptInput = {
  amount: bigint;
  currency: string;
  channel: PaymentChannel;
  receivedAt: Date;
  evidenceUrl: string;
  /** Who actually paid, as declared. Required for `DEPO` - see `requiresPaidBy`. */
  paidBy?: string;
  correctsId?: string;
  note?: string;
};

/**
 * What a proof may be. A money dispute is settled by a document, so the list is
 * documents and photographs of documents - nothing executable, nothing that
 * renders differently for different readers.
 */
export const PROOF_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
] as const;

/**
 * The states after which a reservation may have a *new* payment.
 *
 * The payment ended and the money never arrived, so asking again is the point of
 * the exit. Deliberately not `TERMINAL_STATES`, which also contains `VALIDE` -
 * see `requestPaymentForReservation`.
 */
const REPLACEABLE_STATES: ReadonlySet<PaymentState> = new Set([
  PaymentState.REJETE,
  PaymentState.EXPIRE,
  PaymentState.ANNULE,
]);

/** True for the unique-index violation on `Payment.reference`. */
const isReferenceCollision = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: string }).code === 'P2002' &&
  JSON.stringify((error as { meta?: unknown }).meta ?? '').includes('reference');

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: LandsPrismaService,
    private readonly channels: PaymentChannelsService,
    private readonly emailService: EmailService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly core: CorePrismaService,
  ) {}

  /**
   * Creates a payment, with its reference. **There is no path that creates one
   * without.**
   *
   * The reference is assigned here, at creation, and never later - a payment
   * that exists for even a moment without one is a payment somebody could be
   * asked to pay against nothing.
   *
   * **Collision-free by construction.** The body encodes a Postgres sequence
   * value, and `nextval` is serialised across concurrent transactions: it never
   * returns the same number twice. Randomness would have been *unlikely* to
   * collide, which is a different property and not the one asked for. A
   * bijection over the 29^5 body space scrambles the appearance so consecutive
   * payments do not read as a running count of the month's business; a bijection
   * cannot collide, so it costs nothing.
   *
   * **When the unique index fires anyway.** It can only do so if the counter has
   * wrapped 20 511 149 values inside one month. The insert is retried with a
   * fresh sequence value, up to `REFERENCE_ATTEMPTS` times. The retry is the
   * point: a `P2002` rolls the insert back, so nothing half-exists, and the
   * caller either gets a payment or an error - never a payment without a
   * reference, and never a silently dropped one.
   */
  async createPayment(input: {
    reservationId: string;
    /** What this payment pays for (G20). Required: the gates ask by purpose. */
    purpose: PaymentPurpose;
    amountDue: bigint;
    currency: string;
    expiresAt?: Date;
    /** The person creating it. G9: creation is a named act, like every other. */
    createdBy: string;
    /** Written to the audit row. Why this payment exists. */
    reason: string;
  }): Promise<{ id: string; reference: string }> {
    const REFERENCE_ATTEMPTS = 5;
    const collisions: string[] = [];

    /**
     * Before the sequence is touched, so a refused creation does not burn a
     * reference counter value.
     *
     * `assertTransitionIsDeliberate` cannot cover this: it returns early for
     * anything outside `COMMITTING_STATES`, and `INITIE` is not one. It also
     * takes a `from` state, and creation has none. So the same rule is applied
     * here explicitly rather than assumed to be inherited.
     */
    assertActorIsNamed(input.createdBy, 'create a payment');
    if (input.reason.trim() === '') {
      throw new BadRequestException(
        'Creating a payment records why. A blank reason is refused - the audit ' +
          'row would say a payment appeared and nothing else.',
      );
    }

    for (let attempt = 1; attempt <= REFERENCE_ATTEMPTS; attempt++) {
      const reference = buildReference(await this.nextReferenceCounter(), new Date());

      try {
        /**
         * The payment and its first audit row are one write.
         *
         * G7's assessment found that creation wrote no `PaymentTransition` at
         * all: every trail on every environment began at the payment's *second*
         * state, and the only rows with `fromState IS NULL` were the ones the
         * G1 migration backfill wrote. A trail that does not record how a
         * payment came to exist cannot answer the first question anybody asks
         * of it.
         *
         * In the same transaction, because the alternative - create, then write
         * the row - has a window in which a payment exists with no history, and
         * that window is exactly where a crash leaves an orphan nobody can
         * explain.
         */
        const created = await this.prisma.$transaction(async (tx) => {
          const payment = await tx.payment.create({
            data: {
              reference,
              reservationId: input.reservationId,
              purpose: input.purpose,
              amountDue: input.amountDue,
              currency: input.currency,
              expiresAt: input.expiresAt ?? null,
            },
          });

          await tx.paymentTransition.create({
            data: {
              paymentId: payment.id,
              // NULL: this is the row that records the payment coming into
              // existence, which is what the schema reserves it for.
              fromState: null,
              toState: PaymentState.INITIE,
              actorUserId: input.createdBy,
              reason: input.reason,
            },
          });

          return payment;
        });

        this.logger.log('Payment created %o', {
          paymentId: created.id,
          reference,
          reservationId: input.reservationId,
          createdBy: input.createdBy,
          attempt,
        });

        return { id: created.id, reference };
      } catch (error) {
        if (!isReferenceCollision(error)) throw error;

        // Loud, and counted. A retry nobody can see is how "it hardly ever
        // happens" becomes a belief rather than a measurement.
        collisions.push(reference);
        this.logger.warn('Payment reference collided, retrying %o', {
          reference,
          attempt,
          reservationId: input.reservationId,
        });
      }
    }

    throw new ConflictException(
      `Could not allocate a unique payment reference after ${REFERENCE_ATTEMPTS} attempts ` +
        `(${collisions.join(', ')}). No payment was created. This means the reference counter ` +
        `has wrapped the body space within one period, which needs a wider body, not a retry.`,
    );
  }

  /**
   * G9 - the entry point. **The client asks to pay their acompte.**
   *
   * ---------------------------------------------------------------------------
   * Who creates a payment, and why it is the client
   * ---------------------------------------------------------------------------
   * The design decides this and says so twice. Its state table gives, for
   * `INITIE`, a "Qui le declenche" of **"Le client, sur la plateforme"**, and its
   * architecture section reads **"Le client declenche, la plateforme instruit"**.
   *
   * The two alternatives were considered and rejected:
   *
   * - **Automatic, when a reservation reaches a state.** Forbidden outright:
   *   *"Aucune transition n'est automatique sur un evenement metier."* That is
   *   the `KCA_CERTIFIED` lesson, and a payment appearing because a status
   *   changed is an obligation with nobody's name on it.
   * - **A back-office action.** Workable, and it makes the platform the
   *   initiator of a commercial act - the opposite of *"la plateforme n'encaisse
   *   pas, elle orchestre et elle atteste"*. It would also mean a client who
   *   wants the reference has to telephone somebody to get it, which is a strange
   *   thing to require of a reference whose whole purpose is to be *"dictee au
   *   telephone"*. The client's own purchase page already shows the acompte as
   *   pending, with its amount, and no way to act on it.
   *
   * ---------------------------------------------------------------------------
   * The client asks. The client does not say how much.
   * ---------------------------------------------------------------------------
   * There is no amount on the wire. It is read from the reservation, because a
   * caller who can name their own `amountDue` can decide what they owe.
   */
  async requestPaymentForReservation(
    clientUserId: string,
    reservationId: string,
  ): Promise<{ id: string; reference: string; amountDue: string; currency: string }> {
    const reservation = await this.prisma.landReservation.findUnique({
      where: { id: reservationId },
      include: {
        payments: { select: { id: true, reference: true, state: true, purpose: true } },
        land: { select: { totalPrice: true } },
      },
    });

    if (!reservation) throw new NotFoundException(`Reservation ${reservationId} not found`);

    // Read back from the row rather than trusted from the request - the same
    // reason `assertOwnedByThisRun` exists in the journeys.
    if (reservation.clientUserId !== clientUserId) {
      throw new ForbiddenException('This reservation belongs to somebody else.');
    }

    if (reservation.status === 'CANCELLED') {
      throw new BadRequestException(
        'This reservation is cancelled, so there is nothing to pay against it.',
      );
    }

    /**
     * One payment at a time, and the existing one is returned rather than
     * refused.
     *
     * A client who clicks twice, or reloads, must not end up owing two acomptes.
     * Returning what already exists is also what makes the button safe to press
     * again when the first attempt looked like it failed.
     *
     * **Not `TERMINAL_STATES`.** That set contains `VALIDE`, and the first
     * version of this check used it - which would have let a client whose
     * acompte was already settled create a second one and be asked to pay
     * twice. "Terminal" and "may be replaced" are different questions that
     * happen to have three answers in common. Only the three exits where the
     * money did *not* arrive allow a fresh attempt, which is exactly what those
     * exits are for.
     */
    const live = (purpose: PaymentPurpose) =>
      reservation.payments.find(
        (p) => p.purpose === purpose && !REPLACEABLE_STATES.has(p.state as PaymentState),
      );
    const returnExisting = async (existing: { id: string }) => {
      const row = await this.findOrThrow(existing.id);
      this.logger.log('Payment already exists for reservation %o', {
        reservationId,
        paymentId: row.id,
        state: row.state,
      });
      return {
        id: row.id,
        reference: row.reference ?? '',
        amountDue: row.amountDue.toString(),
        currency: row.currency,
      };
    };

    /**
     * G20 - which payment is due is the server's answer, not the client's. The
     * deposit first; the balance once the deposit is settled (`VALIDE`) and the
     * documents are received (step 3). A live payment of the purpose due is
     * returned rather than duplicated.
     */
    const deposit = live(PaymentPurpose.ACOMPTE);
    if (deposit && deposit.state !== PaymentState.VALIDE) return returnExisting(deposit);
    if (deposit) {
      const balance = live(PaymentPurpose.SOLDE);
      if (balance) return returnExisting(balance);
      return this.createBalance(clientUserId, reservation, deposit.id);
    }

    if (reservation.downPaymentAmount === null) {
      throw new BadRequestException(
        'This reservation carries no acompte amount, so no payment can be created ' +
          'from it. That is a data problem on the reservation, not something the ' +
          'client can fix by trying again.',
      );
    }

    // Integer money since 27 September: the deposit's amount due is the column itself.
    const amountDue = reservation.downPaymentAmount;

    const validityDays = this.config.get<number>('PAYMENT_VALIDITY_DAYS', 30);
    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

    const created = await this.createPayment({
      reservationId,
      purpose: PaymentPurpose.ACOMPTE,
      amountDue,
      currency: 'XAF',
      expiresAt,
      createdBy: clientUserId,
      reason: `Acompte requested by the client for reservation ${reservationId}.`,
    });

    return {
      ...created,
      amountDue: amountDue.toString(),
      currency: 'XAF',
    };
  }

  /**
   * G20 - the balance: the parcel's total minus what the deposit RECEIVED,
   * summed over its ledger rows (Visquis, 26 September). Not minus the deposit
   * that was due: a deposit validated short (mobile-money ceilings, transfers in
   * tranches) leaves its shortfall here, visible, instead of a hole nobody sees
   * until reconciliation. Receipts on other purposes are not the land's price
   * and are not counted.
   */
  private async createBalance(
    clientUserId: string,
    reservation: { id: string; documentsReceivedAt: Date | null; land: { totalPrice: bigint } },
    depositPaymentId: string,
  ): Promise<{ id: string; reference: string; amountDue: string; currency: string }> {
    if (!reservation.documentsReceivedAt) {
      throw new BadRequestException(
        'The balance is not due yet: the deposit is settled, and the balance opens ' +
          'once KAMBRIQ has validated the documents.',
      );
    }

    const receipts = await this.prisma.paymentReceipt.findMany({
      where: { paymentId: { in: [depositPaymentId] } },
      select: { amount: true },
    });
    // Whole XAF on both sides: the total and the receipts are integer money.
    const amountDue = reservation.land.totalPrice - sumReceipts(receipts);
    if (amountDue <= 0n) {
      throw new BadRequestException('Nothing remains to be paid on this reservation.');
    }

    const validityDays = this.config.get<number>('PAYMENT_VALIDITY_DAYS', 30);
    const created = await this.createPayment({
      reservationId: reservation.id,
      purpose: PaymentPurpose.SOLDE,
      amountDue,
      currency: 'XAF',
      expiresAt: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000),
      createdBy: clientUserId,
      reason: `Balance requested by the client for reservation ${reservation.id}.`,
    });
    return { ...created, amountDue: amountDue.toString(), currency: 'XAF' };
  }

  /**
   * G13 - the client's declared preference, changed after the request.
   *
   * v03 section 4c. **A wish, not a decision.** It binds nothing, it may be
   * null, and it is written only to `preferredChannel` - never to `channel`,
   * which is the record of what the back office actually chose.
   *
   * ---------------------------------------------------------------------------
   * What used to be here
   * ---------------------------------------------------------------------------
   * `requestInstructions`, by which the client's own click sent an email listing
   * every channel. v03 removes it: *"on n'envoie pas les moyens de paiement a
   * qui clique"*. `INSTRUCTIONS_ENVOYEES` is now the back office's transition,
   * taken after the client is identified and a channel is agreed, and the client
   * has no route that reaches it.
   */
  async setPreferredChannel(
    clientUserId: string,
    paymentId: string,
    preferred: PaymentChannel | null,
  ): Promise<{ preferredChannel: PaymentChannel | null }> {
    const payment = await this.findOrThrow(paymentId);
    const reservation = await this.prisma.landReservation.findUnique({
      where: { id: payment.reservationId },
      select: { clientUserId: true },
    });
    if (!reservation || reservation.clientUserId !== clientUserId) {
      throw new ForbiddenException('This payment belongs to somebody else.');
    }

    if (preferred !== null && !SELECTABLE_CHANNELS.includes(preferred)) {
      throw new BadRequestException(
        `${preferred} is not a way to pay. Choose one of ${SELECTABLE_CHANNELS.join(', ')}.`,
      );
    }

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { preferredChannel: preferred },
    });

    // Kept on the profile so the next request proposes it by default. A
    // default, not a decision: the back office is no more bound by it here than
    // it was the first time.
    await this.core.userProfile.updateMany({
      where: { userId: clientUserId },
      data: { preferredPaymentChannel: preferred },
    });

    return { preferredChannel: preferred };
  }

  /** The channel this client last said suited them, for proposing a default. */
  async lastPreferredChannel(clientUserId: string): Promise<PaymentChannel | null> {
    const profile = await this.core.userProfile.findUnique({
      where: { userId: clientUserId },
      select: { preferredPaymentChannel: true },
    });
    const code = profile?.preferredPaymentChannel;
    return code && SELECTABLE_CHANNELS.includes(code as PaymentChannel)
      ? (code as PaymentChannel)
      : null;
  }

  /**
   * G14 - the client's own payment, with the coordinates once they exist.
   *
   * v03 section 4d: *"Les coordonnees s'affichent sur l'espace du client,
   * derriere son authentification."* This is that place. Before the back office
   * has chosen, the payment comes back **with the reason it is still waiting**
   * rather than as a blank - a client who asked to pay and sees nothing cannot
   * tell whether the request arrived.
   *
   * The declared preference is returned throughout, decided or not, so the
   * client can see their request was heard.
   */
  async findForClient(clientUserId: string, paymentId: string) {
    const payment = await this.findOrThrow(paymentId);
    const reservation = await this.prisma.landReservation.findUnique({
      where: { id: payment.reservationId },
      select: { clientUserId: true, land: { select: { title: true } } },
    });
    if (!reservation || reservation.clientUserId !== clientUserId) {
      throw new ForbiddenException('This payment belongs to somebody else.');
    }

    const receipts = await this.prisma.paymentReceipt.findMany({
      where: { paymentId },
      select: { amount: true },
    });
    const received = sumReceipts(receipts);

    // The coordinates as they were actually communicated, read back off the
    // audit row rather than re-fetched: what the client sees is what was sent,
    // even if a parameter has been corrected since.
    const sent = await this.prisma.paymentTransition.findFirst({
      where: { paymentId, toState: PaymentState.INSTRUCTIONS_ENVOYEES },
      orderBy: { occurredAt: 'desc' },
      select: { channel: true, communicatedDetails: true, occurredAt: true },
    });

    const profile = await this.core.userProfile.findUnique({
      where: { userId: clientUserId },
      select: { idVerificationStatus: true },
    });
    const identity = profile?.idVerificationStatus ?? IdVerificationStatus.NONE;

    return {
      id: payment.id,
      reference: payment.reference,
      subject: reservation.land.title,
      state: payment.state,
      currency: payment.currency,
      amountDue: payment.amountDue.toString(),
      amountReceived: received.toString(),
      outstanding: (payment.amountDue - received).toString(),
      expiresAt: payment.expiresAt,
      /** The wish. Shown whether or not the back office has decided. */
      preferredChannel: payment.preferredChannel,
      /** The decision. Null until the coordinates have been sent. */
      channel: sent?.channel ?? payment.channel ?? null,
      coordinates: (sent?.communicatedDetails as Record<string, string> | null) ?? null,
      sentAt: sent?.occurredAt ?? null,
      identityStatus: identity,
      /**
       * Why nothing has arrived yet, in words, on the client's side too.
       *
       * A gate that blocks silently is indistinguishable from a system that
       * forgot. The client is told which of the two conditions is outstanding.
       */
      waitingReason:
        payment.state !== PaymentState.INITIE
          ? null
          : identity !== IdVerificationStatus.VERIFIED
            ? 'identity'
            : 'backoffice',
    };
  }

  /**
   * G12 - the request queue: every payment still in `INITIE`, oldest first.
   *
   * v03 section 4d: *"Une demande qui attend depuis trop longtemps remonte dans
   * une file back-office, au meme titre qu'un paiement en souffrance. Un client
   * qui a demande a payer et a qui personne n'a repondu est exactement le genre
   * de silence que ce systeme existe pour rendre impossible."*
   *
   * Carries the age of each request and the identity status, because the two
   * together are what decides what the reviewer does next: an old request whose
   * client is unverified is waiting on the review queue, not on the back office.
   */
  async listRequests(pagination: PaginationQuery) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where: { state: PaymentState.INITIE },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where: { state: PaymentState.INITIE } }),
    ]);

    const reservations = await this.prisma.landReservation.findMany({
      where: { id: { in: rows.map((r) => r.reservationId) } },
      select: { id: true, clientUserId: true, clientName: true, land: { select: { title: true } } },
    });
    const byId = new Map(reservations.map((r) => [r.id, r]));

    const clientIds = reservations.map((r) => r.clientUserId).filter((v): v is string => !!v);
    const profiles = clientIds.length
      ? await this.core.userProfile.findMany({
          where: { userId: { in: clientIds } },
          select: { userId: true, idVerificationStatus: true },
        })
      : [];
    const statusByUser = new Map(profiles.map((p) => [p.userId, p.idVerificationStatus]));

    const now = Date.now();

    const data = rows.map((p) => {
      const reservation = byId.get(p.reservationId);
      const identity = reservation?.clientUserId
        ? (statusByUser.get(reservation.clientUserId) ?? IdVerificationStatus.NONE)
        : IdVerificationStatus.NONE;
      return {
        id: p.id,
        reference: p.reference,
        purpose: p.purpose,
        clientName: reservation?.clientName ?? null,
        clientUserId: reservation?.clientUserId ?? null,
        subject: reservation?.land.title ?? null,
        currency: p.currency,
        amountDue: p.amountDue.toString(),
        preferredChannel: p.preferredChannel,
        identityStatus: identity,
        /** Whether a send would be refused right now, and therefore what to do. */
        blockedByIdentity: identity !== IdVerificationStatus.VERIFIED,
        requestedAt: p.createdAt,
        waitingDays: ageInDays(p.createdAt, now),
      };
    });

    const response = buildPaginatedResponse(data, total, page, limit);
    // The backlog as a whole, not only this page. A queue you cannot age is a
    // queue nobody can be accountable for - A10's lesson, applied here, and
    // shared with the identity and dunning queues since G6.
    return withOldestWaiting(response, rows.length ? rows[0].createdAt : null, now);
  }

  /** The next sequence value. Serialised by Postgres, so never twice the same. */
  private async nextReferenceCounter(): Promise<number> {
    const rows = await this.prisma.$queryRaw<
      { nextval: bigint }[]
    >`SELECT nextval('payment_reference_seq')`;
    return Number(rows[0].nextval);
  }

  /**
   * Sends the payment instructions, then moves the payment to
   * `INSTRUCTIONS_ENVOYEES`.
   *
   * ---------------------------------------------------------------------------
   * The ordering, which is the whole point of this method
   * ---------------------------------------------------------------------------
   * **Send first. Transition only if the send succeeded.**
   *
   * The other order is the tempting one - mark it sent, then send - and it
   * produces the state this system must never be in: a payment sitting in
   * `INSTRUCTIONS_ENVOYEES` that nobody was ever told about. Nothing downstream
   * can tell that apart from a client who is ignoring their instructions. The
   * dunning queue would chase them, the back office would see a payment awaiting
   * money, and the client would be waiting for an email that does not exist.
   *
   * This way round the worst case is a **duplicate** instruction: the enqueue
   * succeeded, the transition failed, a retry sends a second copy of a message
   * the client already has. Annoying, and honest - the state never claims
   * something that did not happen.
   *
   * `EmailService.send` enqueues; delivery is the processor's job and its
   * failures are visible on the failed set. What is guaranteed here is that
   * **nothing is marked sent that was not at least handed to the queue.**
   */
  async sendInstructions(
    paymentId: string,
    by: {
      actorUserId: string;
      /** Chosen by the back office. Never read from `preferredChannel`. */
      channel: PaymentChannel;
      reason: string;
    },
  ): Promise<{ state: PaymentState; reference: string; channel: PaymentChannel }> {
    const payment = await this.findOrThrow(paymentId);

    if (!payment.reference) {
      throw new BadRequestException(
        `Payment ${paymentId} has no reference, so no instruction can be sent. ` +
          `It predates G2 and needs one before anybody is asked to pay it.`,
      );
    }

    if (!SELECTABLE_CHANNELS.includes(by.channel)) {
      // `HIST` records a row taken over from the old model. It is not something
      // a person may choose, and it has no coordinates to send.
      throw new BadRequestException(
        `${by.channel} cannot be chosen as a way to pay. Choose one of ` +
          `${SELECTABLE_CHANNELS.join(', ')}.`,
      );
    }

    const reservation = await this.prisma.landReservation.findUnique({
      where: { id: payment.reservationId },
      select: { clientUserId: true, clientName: true, land: { select: { title: true } } },
    });
    if (!reservation?.clientUserId) {
      throw new BadRequestException('This reservation has no client account to answer.');
    }

    /**
     * The gate, **before the send and not only inside `transition`**.
     *
     * `transition` guards the corridor and is where the rule lives, but G3's
     * ordering sends the message first and transitions afterwards - so a gate
     * that only fired there let an unverified client receive the notification
     * and merely stopped the state from moving. Caught by
     * `payment-identification-gate.spec.ts`, which asserted that nothing was
     * sent and found two emails.
     *
     * One rule, one method, called at both points: here so nothing leaves, and
     * there so nothing gets round it.
     */
    await this.assertClientIsIdentified(
      payment.reservationId,
      payment.state as PaymentState,
      PaymentState.INSTRUCTIONS_ENVOYEES,
    );

    /**
     * The details are fetched **before** anything is written, and only for the
     * chosen channel. A send that cannot say where the money goes fails here,
     * with the missing parameter named, rather than producing a message with a
     * blank in it.
     */
    const details = await this.channels.detailsFor(by.channel);

    const client = await this.core.user.findUnique({
      where: { id: reservation.clientUserId },
      select: { email: true, preferredLanguage: true },
    });
    if (!client) throw new BadRequestException('The client account no longer exists.');

    /**
     * **The email is a notification. It carries no coordinates.**
     *
     * v03 section 4d: the coordinates render on the client's own page, behind
     * their authentication, and the email only says they are available. Three
     * reasons, in the design's order: the whole exchange then sits in the same
     * place as the payment; bank details do not lie around in a forwardable
     * mailbox; and on the day of a dispute what was communicated is established
     * by the system rather than by a screenshot.
     *
     * `no-coordinates-in-email.spec.ts` fails if any channel detail can reach an
     * outbound body.
     */
    await this.emailService.send({
      to: client.email,
      template: 'paymentInstructionsAvailable',
      lang: client.preferredLanguage ?? 'fr',
      args: {
        clientName: reservation.clientName,
        subject: reservation.land.title,
        reference: payment.reference,
        amount: formatMoney(payment.amountDue, payment.currency),
        channelLabel: channelLabel(by.channel),
        url: `${this.config.get<string>('FRONTEND_URL', '')}/mylands/payment/${payment.id}`,
        // The support contact, and **only** that: a number to call for help is
        // not a place to send money. Without it the footer rendered
        // "Ecrivez a  ou appelez le ," - two blanks in a sentence, which is the
        // G3 lesson exactly: found by reading what arrived, not by inspecting
        // what was sent.
        supportEmail: details['supportEmail'] ?? '',
        supportPhone: details['supportPhone'] ?? '',
      },
    });

    /**
     * Sent, then recorded - the G3 ordering, unchanged. The worst case is a
     * duplicate notification; the state never claims a message that did not go.
     *
     * The validity period runs from **here**, not from creation: v03 fixes it at
     * "30 jours a compter de l'envoi des instructions", and a clock that starts
     * before the client has been told anything counts down against them for
     * nothing.
     */
    const validityDays = this.config.get<number>('PAYMENT_VALIDITY_DAYS', 30);

    const result = await this.transition(paymentId, PaymentState.INSTRUCTIONS_ENVOYEES, {
      actorUserId: by.actorUserId,
      reason: by.reason,
      channel: by.channel,
      expiresAt: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000),
      details,
    });

    return { state: result.state, reference: payment.reference, channel: by.channel };
  }

  /**
   * Sends a reminder. **Changes no state**, deliberately.
   *
   * A reminder is a repetition, not an event: the payment is still where it was,
   * and moving it would make "we reminded them" indistinguishable from "they did
   * something".
   *
   * **When a reminder fires is `G6`**, with the dunning queue. This is the
   * message and the path to send it; G6 calls this.
   */
  async sendReminder(
    paymentId: string,
    to: { email: string; clientName: string; lang: string },
    context: { subject: string },
  ): Promise<{ sent: true; overdue: boolean }> {
    const payment = await this.findOrThrow(paymentId);

    if (!payment.reference) {
      throw new BadRequestException(`Payment ${paymentId} has no reference; refusing to remind.`);
    }

    const overdue = payment.expiresAt !== null && payment.expiresAt.getTime() < Date.now();

    /**
     * The reminder repeats the *reference*, not the coordinates.
     *
     * It used to render the whole channel block again - the same leak as the
     * instruction email, on a message sent to people who had not opened the
     * first one. It now points at the client's page, where the coordinates for
     * the channel actually chosen are already waiting.
     */
    await this.emailService.send({
      to: to.email,
      template: 'paymentReminder',
      lang: to.lang,
      args: {
        clientName: to.clientName,
        subject: context.subject,
        reference: payment.reference,
        amount: formatMoney(payment.amountDue, payment.currency),
        deadline: formatHumanDate(payment.expiresAt),
        url: `${this.config.get<string>('FRONTEND_URL', '')}/mylands/payment/${payment.id}`,
        overdue: String(overdue),
        // Same footer, same reason. Read the reminder as a message too: the
        // instruction email rendered "Ecrivez a  ou appelez le ," because these
        // two were missing, and this template shares that footer.
        ...(await this.supportContact()),
      },
    });

    this.logger.log('Payment reminder sent %o', { paymentId, overdue });
    return { sent: true, overdue };
  }

  /**
   * `instructionArgs` is deleted, not left unused.
   *
   * It built the v02 message by spreading **every** channel detail into the
   * template args - `...channels` - which is precisely what v03 4d forbids. An
   * unused function that assembles bank details into an email payload is one
   * call away from being used again, and the next person to need "the args for
   * an instruction email" would have found it and been right to.
   *
   * `sendInstructions` now calls `channels.detailsFor(channel)`, which returns
   * one channel's fields and nothing else, and puts them on the audit row rather
   * than in the message.
   */

  /**
   * Appends one line to the ledger. Never changes the payment's state.
   *
   * A correction is a new signed line pointing at the line it corrects, which
   * is why `amount` is not constrained to be positive. Nothing here edits an
   * existing row; the database refuses that anyway.
   */
  async recordReceipt(
    paymentId: string,
    input: RecordReceiptInput,
    recordedBy: string,
  ): Promise<{ id: string }> {
    const payment = await this.findOrThrow(paymentId);

    /**
     * A deposit names who handed the money over.
     *
     * Enforced here as well as in the DTO and in a CHECK constraint: the DTO
     * guards one route, the service guards every caller, and the database
     * guards the console.
     *
     * **The historic exception cannot be used to escape this.** `HIST` is
     * refused as an input outright a few lines below, so there is no channel
     * that skips both the payer and the proof.
     *
     * The first version of this check sat *inside* the `RECORDABLE_CHANNELS`
     * rejection below, so it ran only for channels that were already refused -
     * which is to say never. Caught by its own test resolving where it should
     * have rejected.
     */
    if (requiresPaidBy(input.channel) && (input.paidBy ?? '').trim() === '') {
      throw new BadRequestException(
        `A ${input.channel} receipt must name who paid. A deposit is made at a ` +
          `counter, often by somebody who is not the client, and a slip bearing an ` +
          `unrecognised name cannot be matched to anything.`,
      );
    }

    if (!RECORDABLE_CHANNELS.includes(input.channel)) {
      // INCONNU_HISTORIQUE belongs to backfilled rows. Accepting it as an input
      // would let new data claim it has no channel because it never had one.
      throw new BadRequestException(
        `Channel ${input.channel} cannot be recorded. It exists only for rows backfilled from the pre-G1 columns.`,
      );
    }
    if (input.currency !== payment.currency) {
      throw new BadRequestException(
        `Receipt currency ${input.currency} does not match payment currency ${payment.currency}.`,
      );
    }
    if (input.amount === 0n) {
      throw new BadRequestException('A receipt of zero records nothing. Refusing it.');
    }
    if (!input.evidenceUrl?.trim()) {
      throw new BadRequestException(
        'A receipt requires its justificatif. Evidence is what separates a record from an assertion.',
      );
    }

    /**
     * Processes payment ledger corrections with mandatory audit trails.
     * Enforces append-only semantics; corrections create new entries detailing
     * the author, reason, and target entry, without modifying historical data.
     */
    if (input.correctsId !== undefined) {
      if ((input.note ?? '').trim() === '') {
        throw new BadRequestException(
          'A correction carries its own reason. Say what was wrong with the line it corrects.',
        );
      }
      const corrected = await this.prisma.paymentReceipt.findUnique({
        where: { id: input.correctsId },
        select: { id: true, paymentId: true },
      });
      if (!corrected || corrected.paymentId !== paymentId) {
        throw new BadRequestException(
          `Receipt ${input.correctsId} is not on the ledger of payment ${paymentId}. A ` +
            `correction points at one of this payment's own lines.`,
        );
      }
    }

    const created = await this.prisma.paymentReceipt.create({
      data: {
        paymentId,
        amount: input.amount,
        currency: input.currency,
        channel: input.channel,
        receivedAt: input.receivedAt,
        recordedBy,
        evidenceUrl: input.evidenceUrl,
        paidBy: input.paidBy?.trim() || null,
        correctsId: input.correctsId ?? null,
        note: input.note ?? null,
      },
    });

    // Amount deliberately absent from the log line: it is money, and the row is
    // the record. The id is what makes the row findable.
    this.logger.log('Payment receipt recorded %o', {
      paymentId,
      receiptId: created.id,
      channel: input.channel,
      recordedBy,
      correctsId: input.correctsId ?? null,
    });

    return { id: created.id };
  }

  /**
   * Retrieves payment ledgers computing outstanding balances dynamically.
   * Eliminates stored state for balances to prevent drift against ledger entries.
   */
  async listForBackOffice(query: PaginationQuery) {
    const { page, limit } = query;
    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { receipts: { select: { amount: true } } },
      }),
      this.prisma.payment.count(),
    ]);

    return buildPaginatedResponse(
      payments.map((p) => {
        const received = sumReceipts(p.receipts);
        return {
          id: p.id,
          reference: p.reference,
          purpose: p.purpose,
          reservationId: p.reservationId,
          state: p.state,
          currency: p.currency,
          amountDue: p.amountDue.toString(),
          amountReceived: received.toString(),
          outstanding: (p.amountDue - received).toString(),
          expiresAt: p.expiresAt,
          createdAt: p.createdAt,
        };
      }),
      total,
      page,
      limit,
    );
  }

  /**
   * One payment, with its ledger and its full history.
   *
   * `amountReceived` and `outstanding` are computed on every read. A caller
   * cannot obtain them any other way, because the columns do not exist.
   */
  async findForBackOffice(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        receipts: { orderBy: { receivedAt: 'asc' } },
        transitions: { orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);

    const received = sumReceipts(payment.receipts);

    // The identity status travels with the payment so the send control can say
    // why it is refusing before anybody presses it.
    const reservation = await this.prisma.landReservation.findUnique({
      where: { id: payment.reservationId },
      select: { clientUserId: true },
    });
    const profile = reservation?.clientUserId
      ? await this.core.userProfile.findUnique({
          where: { userId: reservation.clientUserId },
          select: { idVerificationStatus: true },
        })
      : null;
    const identity = profile?.idVerificationStatus ?? IdVerificationStatus.NONE;
    return {
      id: payment.id,
      reference: payment.reference,
      purpose: payment.purpose,
      reservationId: payment.reservationId,
      state: payment.state,
      currency: payment.currency,
      amountDue: payment.amountDue.toString(),
      amountReceived: received.toString(),
      outstanding: (payment.amountDue - received).toString(),
      expiresAt: payment.expiresAt,
      createdAt: payment.createdAt,
      // v03 4c: both, always, and separately. The screen shows the wish beside
      // the decision so a divergence is visible rather than silent.
      preferredChannel: payment.preferredChannel,
      channel: payment.channel,
      clientUserId: reservation?.clientUserId ?? null,
      identityStatus: identity,
      receipts: payment.receipts.map((r) => ({
        id: r.id,
        amount: r.amount.toString(),
        currency: r.currency,
        channel: r.channel,
        receivedAt: r.receivedAt,
        recordedAt: r.recordedAt,
        recordedBy: r.recordedBy,
        paidBy: r.paidBy,
        evidenceUrl: r.evidenceUrl,
        correctsId: r.correctsId,
        note: r.note,
      })),
      transitions: payment.transitions.map((t) => ({
        id: t.id,
        fromState: t.fromState,
        toState: t.toState,
        actorUserId: t.actorUserId,
        reason: t.reason,
        evidenceReceiptId: t.evidenceReceiptId,
        // Declared on the web's `PaymentTransition` type since G11 and never
        // mapped here, so the screen typed a field the API did not send.
        channel: t.channel,
        occurredAt: t.occurredAt,
      })),
    };
  }

  /**
   * A presigned PUT for one proof.
   *
   * The object is written under `payments/<paymentId>/` in the private bucket -
   * the one with all four public-access blocks on, proven on 4 September. **A
   * proof is evidence in a money dispute and outlives the payment**, so it is
   * never publicly readable and is fetched through a short-lived presigned GET.
   */
  async getProofUploadUrl(paymentId: string, input: { fileName: string; contentType: string }) {
    await this.findOrThrow(paymentId);

    if (!(PROOF_CONTENT_TYPES as readonly string[]).includes(input.contentType)) {
      throw new BadRequestException(
        `${input.contentType} is not accepted as a proof. Allowed: ${PROOF_CONTENT_TYPES.join(', ')}.`,
      );
    }

    /**
     * The key is built from the file name, so the file name is not trusted.
     *
     * Only the basename is kept - anything before the last separator is
     * discarded rather than escaped - then every character outside
     * `[A-Za-z0-9._-]` becomes `_`, then runs of dots collapse to one. The
     * first version replaced separators and kept the dots, so
     * `../../etc/passwd` became `.._.._etc_passwd`: harmless in S3, which has a
     * flat key space, and not harmless the day something syncs these objects to
     * a filesystem or a tool normalises the path. Caught by asserting the
     * absence of `..` rather than the absence of `/`.
     */
    const base = input.fileName.split(/[\\/]/).pop() || 'proof';
    const safe = base
      .replace(/[^A-Za-z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .slice(-120);
    const key = `payments/${paymentId}/${Date.now()}-${safe}`;

    // `getUploadUrl` returns `{ uploadUrl, fileUrl }`, so the string has to be
    // taken out of it. Assigning the whole object to `uploadUrl` typechecked,
    // passed every unit test, and made the browser PUT the file at
    // `/admin/payments/[object Object]` - a upload that failed against the web
    // app instead of S3.
    const { uploadUrl } = await this.storage.getUploadUrl(key, input.contentType);

    return { uploadUrl, key };
  }

  /** A short-lived link to read one proof back. Never a public URL. */
  async getProofDownloadUrl(paymentId: string, receiptId: string) {
    const receipt = await this.prisma.paymentReceipt.findUnique({ where: { id: receiptId } });
    if (!receipt || receipt.paymentId !== paymentId) {
      throw new NotFoundException(`Receipt ${receiptId} not found on payment ${paymentId}`);
    }
    if (!receipt.evidenceUrl) {
      // Only an INCONNU_HISTORIQUE row can be here, and it has no proof by
      // definition: the pre-G1 model never recorded one.
      throw new NotFoundException(`Receipt ${receiptId} carries no proof (pre-G1 row)`);
    }
    return { downloadUrl: await this.storage.getDownloadUrl(receipt.evidenceUrl) };
  }

  /**
   * Commits a payment validation.
   * Structurally separates the act of recording a receipt from validating it.
   * Captures explicit actor and rationale for the transition.
   */
  async validate(
    paymentId: string,
    by: { actorUserId: string; reason: string; evidenceReceiptId?: string },
  ): Promise<{ state: PaymentState; outstanding: string }> {
    const payment = await this.findOrThrow(paymentId);

    await this.assertFourEyesIfRequired(payment.id, by.actorUserId, payment.amountDue);

    const result = await this.transition(paymentId, PaymentState.VALIDE, by);

    const receipts = await this.prisma.paymentReceipt.findMany({
      where: { paymentId },
      select: { amount: true },
    });
    return {
      state: result.state,
      outstanding: (payment.amountDue - sumReceipts(receipts)).toString(),
    };
  }

  /**
   * Where the four-eyes rule goes when it is decided.
   *
   * The design leaves it open: *"au-dela d'un seuil de montant, exiger que le
   * validateur soit une personne differente de celle qui a saisi
   * l'encaissement"*. It is an operational constraint and it waits until
   * somebody knows who does what daily.
   *
   * **The seam is here rather than the rule.** When it is decided this method
   * reads the receipts' `recordedBy`, compares them with `actorUserId` above a
   * threshold, and throws - so it becomes a guard rather than a rewrite, and it
   * sits on the validate path where the money is committed rather than on the
   * recording path where it is not.
   *
   * The parameters are unused **on purpose**: they are exactly the three values
   * the rule will need, named now so that writing it is a body and not a change
   * to every caller. Dropping them to silence the linter would move that work
   * to the day the rule is decided, which is the day it is least welcome.
   */
  /* eslint-disable @typescript-eslint/no-unused-vars -- the seam's signature is the decision; see above. */
  private async assertFourEyesIfRequired(
    _paymentId: string,
    _actorUserId: string,
    _amountDue: bigint,
  ): Promise<void> {
    return;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  /**
   * The total received, computed over the ledger. There is no stored total.
   *
   * `Payment` has no `totalReceived` column, so this is not "the preferred way"
   * to obtain the figure - it is the only way. A number you can edit by hand is
   * a number that lies one day, and the day it lies nothing signals it.
   */
  async totalReceived(paymentId: string): Promise<bigint> {
    await this.findOrThrow(paymentId);
    const receipts = await this.prisma.paymentReceipt.findMany({
      where: { paymentId },
      select: { amount: true },
    });
    return sumReceipts(receipts);
  }

  /**
   * Moves a payment, and writes the audit row that says why.
   *
   * Two guards, both barriers rather than assertions:
   *
   * - `assertTransitionAllowed` refuses an edge the state machine does not have;
   * - `assertTransitionIsDeliberate` refuses a transition that commits money
   *   unless a named person asked for it and gave a reason. This is the
   *   `KCA_CERTIFIED` lesson - a business event must never cross a committing
   *   boundary by itself - and here the boundary commits money.
   */
  /**
   * Advances payment state through the legal state machine.
   * Enforces role-based permissions dynamically: `COMMITTING_STATES` are gated
   * to `ADMIN_GLOBAL`, while standard state transitions allow `ADMIN_LANDS`.
   */
  async transitionAsAdmin(
    paymentId: string,
    to: PaymentState,
    by: {
      actorUserId: string;
      reason: string;
      roles: readonly string[];
      /** The receipt the step rests on. Required for the states that assert money arrived. */
      evidenceReceiptId?: string;
    },
  ): Promise<{ state: PaymentState }> {
    if (COMMITTING_STATES.has(to) && !by.roles.includes(RoleCode.ADMIN_GLOBAL)) {
      throw new ForbiddenException(
        `Moving a payment to ${to} commits money and is reserved to ` +
          `${RoleCode.ADMIN_GLOBAL}. Recording an encaissement is not.`,
      );
    }
    return this.transition(paymentId, to, {
      actorUserId: by.actorUserId,
      reason: by.reason,
      evidenceReceiptId: by.evidenceReceiptId,
    });
  }

  async transition(
    paymentId: string,
    to: PaymentState,
    by: {
      actorUserId: string;
      reason: string;
      evidenceReceiptId?: string;
      /** Set only by the send: what the back office chose and communicated. */
      channel?: PaymentChannel;
      /** Set only by the send: the validity period runs from the send. */
      expiresAt?: Date;
      /** The coordinates communicated, stored so a dispute reads them back. */
      details?: Record<string, string>;
    },
  ): Promise<{ state: PaymentState }> {
    const payment = await this.findOrThrow(paymentId);
    const from = payment.state as PaymentState;

    assertTransitionAllowed(from, to);
    assertTransitionIsDeliberate(to, by.actorUserId, by.reason);
    await this.assertClientIsIdentified(payment.reservationId, from, to);
    assertTransitionIsEvidenced(to, by.evidenceReceiptId);
    await this.assertReceiptBelongsTo(paymentId, by.evidenceReceiptId);

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          state: to,
          // Written here and nowhere else. `preferredChannel` is never touched
          // by a transition: a wish is not a record of what was used.
          ...(by.channel ? { channel: by.channel } : {}),
          ...(by.expiresAt ? { expiresAt: by.expiresAt } : {}),
        },
      }),
      this.prisma.paymentTransition.create({
        data: {
          paymentId,
          fromState: from,
          toState: to,
          actorUserId: by.actorUserId,
          reason: by.reason,
          evidenceReceiptId: by.evidenceReceiptId ?? null,
          channel: by.channel ?? null,
          // What was actually communicated, so a dispute is settled by the
          // system and not by somebody's screenshot.
          communicatedDetails: by.details ?? undefined,
        },
      }),
    ]);

    this.logger.log('Payment transitioned %o', {
      paymentId,
      from,
      to,
      actorUserId: by.actorUserId,
    });

    return { state: to };
  }

  /**
   * Enforces client identity verification before dispatching bank details.
   * Prevents funds from transitioning from `INITIE` to `INSTRUCTIONS_ENVOYEES`
   * unless the client has successfully cleared the identification review process.
   */
  private async assertClientIsIdentified(
    reservationId: string,
    from: PaymentState,
    to: PaymentState,
  ): Promise<void> {
    if (from !== PaymentState.INITIE || to !== PaymentState.INSTRUCTIONS_ENVOYEES) return;

    const reservation = await this.prisma.landReservation.findUnique({
      where: { id: reservationId },
      select: { clientUserId: true, clientName: true },
    });

    if (!reservation?.clientUserId) {
      throw new BadRequestException(
        `This reservation has no client account, so there is nobody whose identity ` +
          `could have been verified. The coordinates are not released.`,
      );
    }

    const profile = await this.core.userProfile.findUnique({
      where: { userId: reservation.clientUserId },
      select: { idVerificationStatus: true },
    });

    const status = profile?.idVerificationStatus ?? IdVerificationStatus.NONE;
    if (status !== IdVerificationStatus.VERIFIED) {
      throw new ForbiddenException(
        `Payment coordinates are released only to a client whose identity has been ` +
          `verified. ${reservation.clientName}'s identity is "${status}" - ` +
          `${status === IdVerificationStatus.PENDING ? 'a document is waiting in the review queue' : status === IdVerificationStatus.REJECTED ? 'their document was rejected' : 'no document has been submitted'}. ` +
          `Verify it from the identity review queue, then send.`,
      );
    }
  }

  /**
   * Validates that an evidence receipt explicitly belongs to the payment in question.
   * Guards against cross-payment referencing in audit rows prior to state transitions.
   */
  private async assertReceiptBelongsTo(
    paymentId: string,
    evidenceReceiptId: string | undefined,
  ): Promise<void> {
    if (evidenceReceiptId === undefined) return;

    const receipt = await this.prisma.paymentReceipt.findUnique({
      where: { id: evidenceReceiptId },
      select: { id: true, paymentId: true },
    });

    if (!receipt || receipt.paymentId !== paymentId) {
      throw new BadRequestException(
        `Receipt ${evidenceReceiptId} is not on the ledger of payment ${paymentId}. A ` +
          `transition rests on one of this payment's own encaissements, or on none.`,
      );
    }
  }

  /**
   * The support contact, for the footer every payment message carries.
   *
   * Not a coordinate - a number to call for help is not a place to send money -
   * so it rides on messages that deliberately carry no bank details.
   */
  private async supportContact(): Promise<{ supportEmail: string; supportPhone: string }> {
    const all = await this.channels.get();
    return { supportEmail: all.supportEmail, supportPhone: all.supportPhone };
  }

  private async findOrThrow(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);
    return payment;
  }
}
