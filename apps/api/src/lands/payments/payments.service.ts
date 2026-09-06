import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  assertTransitionAllowed,
  assertTransitionIsDeliberate,
  PaymentChannel,
  PaymentState,
  RECORDABLE_CHANNELS,
  sumReceipts,
} from '@kambriq/common';
import { LandsPrismaService } from '../prisma/lands-prisma.service';

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

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: LandsPrismaService) {}

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
