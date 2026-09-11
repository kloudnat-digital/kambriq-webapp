import { randomUUID } from 'node:crypto';
import { buildReference, PaymentChannel, SELECTABLE_CHANNELS } from '@kambriq/common';
import {
  attempt,
  createPaymentFixture,
  openTestDatabase,
  SQLSTATE,
  type TestDatabase,
} from './lands-test-db';

/**
 * A17 - the CHECK constraints on the payment tables, exercised.
 *
 * Three from G1 (evidence, reference format, currency) and two from G11 (the
 * DEPO payer, and HIST never being a chosen channel). Each is asserted by the
 * constraint's own name in the refusal, so a test cannot pass because some
 * *other* rule refused the same row.
 *
 * The rows are sent as SQL, past the DTO and past the service. The constraint
 * is the backstop for the caller that goes round both, and that is the caller
 * being simulated.
 *
 * Proved sharp on 2026-09-09 by dropping each constraint in a scratch migration
 * and watching its tests fail with `Received: null`. See the register, A17.
 */
describe('A17 - the CHECK constraints refuse what the design forbids', () => {
  let db: TestDatabase;

  beforeAll(() => {
    db = openTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  const insertReceipt = (
    paymentId: string,
    over: {
      channel?: string;
      evidenceUrl?: string | null;
      currency?: string;
      paidBy?: string | null;
    } = {},
  ) =>
    attempt(
      db.pool,
      `INSERT INTO "PaymentReceipt"
         ("id", "paymentId", "amount", "currency", "channel", "receivedAt", "recordedBy", "evidenceUrl", "paidBy")
       VALUES ($1, $2, 100000, $3, $4::"PaymentChannel", now(), 'a17', $5, $6)`,
      [
        randomUUID(),
        paymentId,
        over.currency ?? 'XAF',
        over.channel ?? PaymentChannel.VIR,
        over.evidenceUrl === undefined ? 'payments/a17/proof.pdf' : over.evidenceUrl,
        over.paidBy === undefined ? null : over.paidBy,
      ],
    );

  const insertPayment = (
    reservationId: string,
    over: { reference?: string | null; currency?: string } = {},
  ) =>
    attempt(
      db.pool,
      `INSERT INTO "Payment"
         ("id", "reference", "reservationId", "currency", "amountDue", "state", "updatedAt")
       VALUES ($1, $2, $3, $4, 750000, 'INITIE', now())`,
      [
        randomUUID(),
        over.reference === undefined ? null : over.reference,
        reservationId,
        over.currency ?? 'XAF',
      ],
    );

  // ----- 1. Evidence, and the exception confined to rows taken over ----- //

  describe('PaymentReceipt_evidence_required', () => {
    it('refuses a receipt with no proof', async () => {
      const payment = await createPaymentFixture(db.prisma);

      const refusal = await insertReceipt(payment.id, { evidenceUrl: null });

      expect(refusal).toMatchObject({
        code: SQLSTATE.CHECK_VIOLATION,
        constraint: 'PaymentReceipt_evidence_required',
      });
    });

    it.each(SELECTABLE_CHANNELS)(
      'refuses a %s receipt with no proof - no chosen channel is exempt',
      async (channel) => {
        const payment = await createPaymentFixture(db.prisma);

        const refusal = await insertReceipt(payment.id, {
          channel,
          evidenceUrl: null,
          // DEPO also needs a payer; supplied so that the *evidence* rule is
          // the one refusing, and the constraint name below proves it.
          paidBy: 'Someone',
        });

        expect(refusal).toMatchObject({
          code: SQLSTATE.CHECK_VIOLATION,
          constraint: 'PaymentReceipt_evidence_required',
        });
      },
    );

    it('accepts a HIST row with no proof - the exception for rows taken over', async () => {
      // The pre-G1 model recorded no justificatif. Saying "unknown, historic"
      // is honest where inventing "virement" would not be, and this is the one
      // shape the constraint lets through without evidence.
      const payment = await createPaymentFixture(db.prisma);

      const refusal = await insertReceipt(payment.id, {
        channel: PaymentChannel.HIST,
        evidenceUrl: null,
      });

      expect(refusal).toBeNull();
    });

    it('accepts a receipt that carries its proof', async () => {
      const payment = await createPaymentFixture(db.prisma);

      await expect(insertReceipt(payment.id)).resolves.toBeNull();
    });
  });

  // ----- 2. The reference format ----- //

  describe('Payment_reference_format', () => {
    it.each([
      ['KBQ-2609-7F3K2', 'a missing check character'],
      ['KBQ-2609-7F3O2-B', 'an O, which the alphabet excludes'],
      ['KBQ-2609-7F3K2-b', 'a lower-case check character'],
      ['KBQ-2609-7F3K2-B-OMO', 'a channel appended with a hyphen (v03 4b forbids it)'],
      ['REF-2609-7F3K2-B', 'the wrong prefix'],
    ])('refuses %s (%s)', async (reference) => {
      const payment = await createPaymentFixture(db.prisma);

      const refusal = await insertPayment(payment.reservationId, { reference });

      expect(refusal).toMatchObject({
        code: SQLSTATE.CHECK_VIOLATION,
        constraint: 'Payment_reference_format',
      });
    });

    it('accepts what the generator produces - the SQL alphabet and the TypeScript one agree', async () => {
      // `payment-reference.spec.ts` compares the two alphabets as text. This
      // runs one against the other: a reference the generator built, offered to
      // the CHECK that was written by hand in SQL.
      const payment = await createPaymentFixture(db.prisma);
      const reference = buildReference(Math.floor(Math.random() * 1_000_000) + 1, new Date());

      const refusal = await insertPayment(payment.reservationId, { reference });

      expect(refusal).toBeNull();
    });

    it('accepts NULL - the rows G1 backfilled predate the generator', async () => {
      const payment = await createPaymentFixture(db.prisma);

      await expect(insertPayment(payment.reservationId, { reference: null })).resolves.toBeNull();
    });
  });

  // ----- 3. Currency, on both tables ----- //

  describe('the currency is an upper-case ISO 4217 code', () => {
    it.each(['xaf', 'XA', 'XAFF', 'X4F', ''])(
      'Payment_currency_iso4217 refuses "%s"',
      async (currency) => {
        const payment = await createPaymentFixture(db.prisma);

        const refusal = await insertPayment(payment.reservationId, { currency });

        expect(refusal).toMatchObject({
          code: SQLSTATE.CHECK_VIOLATION,
          constraint: 'Payment_currency_iso4217',
        });
      },
    );

    it.each(['xaf', 'XA', 'XAFF', 'X4F', ''])(
      'PaymentReceipt_currency_iso4217 refuses "%s"',
      async (currency) => {
        const payment = await createPaymentFixture(db.prisma);

        const refusal = await insertReceipt(payment.id, { currency });

        expect(refusal).toMatchObject({
          code: SQLSTATE.CHECK_VIOLATION,
          constraint: 'PaymentReceipt_currency_iso4217',
        });
      },
    );
  });

  // ----- 4. G11 - a deposit names who paid ----- //

  describe('PaymentReceipt_depo_requires_payer', () => {
    it.each([
      [null, 'no payer'],
      ['', 'an empty payer'],
      ['   ', 'a whitespace payer'],
    ])('refuses a DEPO receipt with %s (%s)', async (paidBy) => {
      const payment = await createPaymentFixture(db.prisma);

      const refusal = await insertReceipt(payment.id, { channel: PaymentChannel.DEPO, paidBy });

      expect(refusal).toMatchObject({
        code: SQLSTATE.CHECK_VIOLATION,
        constraint: 'PaymentReceipt_depo_requires_payer',
      });
    });

    it('accepts a DEPO receipt that names the depositor', async () => {
      const payment = await createPaymentFixture(db.prisma);

      await expect(
        insertReceipt(payment.id, { channel: PaymentChannel.DEPO, paidBy: 'Ekani Marcelle' }),
      ).resolves.toBeNull();
    });
  });

  // ----- 5. G11 - HIST is a record of the past, never a choice ----- //

  describe('Payment_channels_are_selectable', () => {
    it.each(['preferredChannel', 'channel'])('refuses HIST in Payment.%s', async (column) => {
      const payment = await createPaymentFixture(db.prisma);

      const refusal = await attempt(
        db.pool,
        `UPDATE "Payment" SET "${column}" = 'HIST' WHERE "id" = $1`,
        [payment.id],
      );

      expect(refusal).toMatchObject({
        code: SQLSTATE.CHECK_VIOLATION,
        constraint: 'Payment_channels_are_selectable',
      });
    });
  });
});
