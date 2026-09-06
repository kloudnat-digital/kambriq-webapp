import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EmailService } from '@kambriq/common';
import {
  buildReference,
  assertTransitionAllowed,
  assertTransitionIsDeliberate,
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

/** Shown when a payment carries no deadline. Never an empty string: a blank in a
 * date position reads as a rendering fault rather than as "no deadline". */
const PAYMENT_NO_DEADLINE = '-';

/**
 * The amount, as a person reads it, with its currency stated once.
 *
 * Not `formatXAF`: that helper appends "FCFA" itself, so composing it with the
 * payment's own `currency` produced **"750 000 FCFA XAF"** in the first real
 * instruction email - the currency twice, one of them hardcoded and wrong for
 * any payment that is not in XAF. Found by reading the message that arrived,
 * not by reading the code.
 *
 * `Intl` with the payment's actual currency code covers both: the grouping a
 * French reader expects, and a currency that is whatever the payment says.
 */
const formatMoney = (amount: bigint, currency: string): string =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(amount))} ${currency}`;

/**
 * The deadline, written out rather than as `2026-10-06`.
 *
 * This message is read on a phone by somebody who may forward it to a relative
 * who did not see the conversation. An ISO date is a machine's format; a date
 * that has to be acted on is written the way the reader writes dates.
 */
const formatDeadline = (at: Date | null): string =>
  at
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(
        at,
      )
    : PAYMENT_NO_DEADLINE;

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
      deadline: formatDeadline(payment.expiresAt),
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
