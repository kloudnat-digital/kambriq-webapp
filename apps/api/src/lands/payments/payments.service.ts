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
  PaginationQuery,
  RoleCode,
  StorageService,
} from '@kambriq/common';
import {
  buildReference,
  assertTransitionAllowed,
  assertTransitionIsDeliberate,
  COMMITTING_STATES,
  PaymentChannel,
  PaymentState,
  RECORDABLE_CHANNELS,
  sumReceipts,
} from '@kambriq/common';
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
    amountDue: bigint;
    currency: string;
    expiresAt?: Date;
  }): Promise<{ id: string; reference: string }> {
    const REFERENCE_ATTEMPTS = 5;
    const collisions: string[] = [];

    for (let attempt = 1; attempt <= REFERENCE_ATTEMPTS; attempt++) {
      const reference = buildReference(await this.nextReferenceCounter(), new Date());

      try {
        const created = await this.prisma.payment.create({
          data: {
            reference,
            reservationId: input.reservationId,
            amountDue: input.amountDue,
            currency: input.currency,
            expiresAt: input.expiresAt ?? null,
          },
        });

        this.logger.log('Payment created %o', {
          paymentId: created.id,
          reference,
          reservationId: input.reservationId,
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
    to: { email: string; clientName: string; lang: string },
    context: { subject: string; actorUserId: string },
  ): Promise<{ state: PaymentState; reference: string }> {
    const payment = await this.findOrThrow(paymentId);

    if (!payment.reference) {
      // G2 assigns one at creation. A payment without one predates the
      // generator and must not be sent: the client would be told to quote
      // nothing, and the money would arrive unmatchable.
      throw new BadRequestException(
        `Payment ${paymentId} has no reference, so no instruction can be sent. ` +
          `It predates G2 and needs one before anybody is asked to pay it.`,
      );
    }

    // Throws if any channel detail is missing. Before the send, before the
    // transition, before anything is written.
    const args = await this.instructionArgs(payment, to.clientName, context.subject);

    await this.emailService.send({
      to: to.email,
      template: 'paymentInstructions',
      lang: to.lang,
      args,
    });

    const result = await this.transition(paymentId, PaymentState.INSTRUCTIONS_ENVOYEES, {
      actorUserId: context.actorUserId,
      reason: `Payment instructions sent to ${to.email}`,
    });

    return { state: result.state, reference: payment.reference };
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
    const args = await this.instructionArgs(payment, to.clientName, context.subject);

    await this.emailService.send({
      to: to.email,
      template: 'paymentReminder',
      lang: to.lang,
      args: { ...args, overdue: String(overdue) },
    });

    this.logger.log('Payment reminder sent %o', { paymentId, overdue });
    return { sent: true, overdue };
  }

  /**
   * Everything both messages need, with the channel details.
   *
   * Throws if any channel detail is missing or blank - so a message with an
   * empty account number cannot be composed, let alone sent.
   */
  private async instructionArgs(
    payment: {
      reference: string | null;
      amountDue: bigint;
      currency: string;
      expiresAt: Date | null;
    },
    clientName: string,
    subject: string,
  ): Promise<Record<string, string>> {
    const channels = await this.channels.get();

    return {
      clientName,
      subject,
      reference: payment.reference ?? '',
      amount: formatMoney(payment.amountDue, payment.currency),
      deadline: formatHumanDate(payment.expiresAt),
      ...channels,
    };
  }

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

    const created = await this.prisma.paymentReceipt.create({
      data: {
        paymentId,
        amount: input.amount,
        currency: input.currency,
        channel: input.channel,
        receivedAt: input.receivedAt,
        recordedBy,
        evidenceUrl: input.evidenceUrl,
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
    });

    return { id: created.id };
  }

  /**
   * The back-office list: every payment with its state, reference and what is
   * still owed.
   *
   * The outstanding balance is `amountDue - sum(receipts)`, computed here from
   * the ledger. **There is no stored balance to read**, and adding one would be
   * the defect G1 exists to prevent.
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
    return {
      id: payment.id,
      reference: payment.reference,
      reservationId: payment.reservationId,
      state: payment.state,
      currency: payment.currency,
      amountDue: payment.amountDue.toString(),
      amountReceived: received.toString(),
      outstanding: (payment.amountDue - received).toString(),
      expiresAt: payment.expiresAt,
      createdAt: payment.createdAt,
      receipts: payment.receipts.map((r) => ({
        id: r.id,
        amount: r.amount.toString(),
        currency: r.currency,
        channel: r.channel,
        receivedAt: r.receivedAt,
        recordedAt: r.recordedAt,
        recordedBy: r.recordedBy,
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
   * Validates a payment. **A separate act from recording, by a named person.**
   *
   * G1 built the separation; here it meets a real user for the first time.
   * Recording a receipt never validates - the back office enters what arrived,
   * and somebody with the authority to commit says that it settles the payment.
   *
   * The reason is required and is recorded on the transition, with the receipt
   * it rests on where there is one.
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
   * Moves a payment one legal step, as a named act with a reason.
   *
   * **Why this exists as its own call.** The path from
   * INSTRUCTIONS_ENVOYEES to VALIDE is five states, and only the last one is
   * `validate`. Without this the back office could record money against a
   * payment and never move it: the screen offered "Valider le paiement" from
   * INSTRUCTIONS_ENVOYEES, the state machine refused it - correctly - and the
   * payment was stuck with 8 000 000 XAF in its ledger and nowhere to go. The
   * transition table was right; nothing could drive it.
   *
   * It stays separate from `recordReceipt` for the reason G1 exists: recording
   * money and agreeing what it means are two acts. This one moves state and
   * touches no money.
   *
   * **Who may do it is derived, not listed.** A state in `COMMITTING_STATES` is
   * one that commits money, and only ADMIN_GLOBAL may reach those. The rest is
   * back-office bookkeeping and ADMIN_LANDS may do it. Deriving the rule from
   * the same set the guard uses means a state added to `COMMITTING_STATES`
   * tomorrow is protected here on the same day - a second hand-written list of
   * "the dangerous ones" would not be.
   */
  async transitionAsAdmin(
    paymentId: string,
    to: PaymentState,
    by: { actorUserId: string; reason: string; roles: readonly string[] },
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
    });
  }

  async transition(
    paymentId: string,
    to: PaymentState,
    by: { actorUserId: string; reason: string; evidenceReceiptId?: string },
  ): Promise<{ state: PaymentState }> {
    const payment = await this.findOrThrow(paymentId);
    const from = payment.state as PaymentState;

    assertTransitionAllowed(from, to);
    assertTransitionIsDeliberate(to, by.actorUserId, by.reason);

    await this.prisma.$transaction([
      this.prisma.payment.update({ where: { id: paymentId }, data: { state: to } }),
      this.prisma.paymentTransition.create({
        data: {
          paymentId,
          fromState: from,
          toState: to,
          actorUserId: by.actorUserId,
          reason: by.reason,
          evidenceReceiptId: by.evidenceReceiptId ?? null,
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

  private async findOrThrow(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);
    return payment;
  }
}
