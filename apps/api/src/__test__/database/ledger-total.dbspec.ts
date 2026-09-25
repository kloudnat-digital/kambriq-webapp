import { PaymentChannel, sumReceipts } from '@kambriq/common';
import {
  attempt,
  createPaymentFixture,
  openTestDatabase,
  SQLSTATE,
  type TestDatabase,
} from './lands-test-db';

/**
 * G5: "L'argent n'est jamais un champ modifiable".
 * Validates immutable ledger appending and aggregation directly against the database trigger constraints.
 * Simulates three movements (two deposits, one correction) asserting that original lines are unmodified
 * and totals are strictly derived.
 */
describe('G5 - the ledger total is computed over appended lines and nothing else', () => {
  let db: TestDatabase;

  beforeAll(() => {
    db = openTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  const RECORDER = 'a17-recorder';
  const CORRECTOR = 'a17-corrector';

  const threeMovements = async () => {
    const payment = await createPaymentFixture(db.prisma, { amountDue: 3_000_000n });

    const first = await db.prisma.paymentReceipt.create({
      data: {
        paymentId: payment.id,
        amount: 500_000n,
        currency: 'XAF',
        channel: PaymentChannel.VIR,
        receivedAt: new Date('2026-09-01T00:00:00Z'),
        recordedBy: RECORDER,
        evidenceUrl: 'payments/a17/first.pdf',
      },
    });
    const second = await db.prisma.paymentReceipt.create({
      data: {
        paymentId: payment.id,
        amount: 2_250_000n,
        currency: 'XAF',
        channel: PaymentChannel.OMO,
        receivedAt: new Date('2026-09-03T00:00:00Z'),
        recordedBy: RECORDER,
        evidenceUrl: 'payments/a17/second.pdf',
      },
    });
    // Correction appends with author, reason, signed amount, and target reference.
    const correction = await db.prisma.paymentReceipt.create({
      data: {
        paymentId: payment.id,
        amount: -250_000n,
        currency: 'XAF',
        channel: PaymentChannel.OMO,
        receivedAt: new Date('2026-09-03T00:00:00Z'),
        recordedBy: CORRECTOR,
        evidenceUrl: 'payments/a17/statement.pdf',
        correctsId: second.id,
        note: 'Keyed 2 250 000 for a confirmation that reads 2 000 000.',
      },
    });

    return { payment, first, second, correction };
  };

  it('a correction changes the total by appending, and the total is the sum of three lines', async () => {
    const { payment } = await threeMovements();

    const lines = await db.prisma.paymentReceipt.findMany({
      where: { paymentId: payment.id },
      orderBy: { recordedAt: 'asc' },
    });
    expect(lines).toHaveLength(3);

    // Application-layer summation of database rows.
    expect(sumReceipts(lines)).toBe(2_500_000n);

    // Database-layer summation parity check.
    const { rows } = await db.pool.query<{ total: string }>(
      'SELECT SUM("amount")::text AS total FROM "PaymentReceipt" WHERE "paymentId" = $1',
      [payment.id],
    );
    expect(rows[0].total).toBe('2500000');
  });

  it('the corrected line is still there, unchanged', async () => {
    const { second, correction } = await threeMovements();

    const original = await db.prisma.paymentReceipt.findUniqueOrThrow({ where: { id: second.id } });
    expect(original.amount).toBe(2_250_000n);
    expect(original.recordedBy).toBe(RECORDER);
    expect(original.correctsId).toBeNull();

    // Assert correction record links to the original without mutation.
    expect(correction.correctsId).toBe(second.id);
    expect(correction.recordedBy).toBe(CORRECTOR);
    expect(correction.recordedBy).not.toBe(original.recordedBy);
    expect(correction.note).toMatch(/Keyed/);
  });

  it('"fixing" the original line instead is refused by the database', async () => {
    const { second } = await threeMovements();

    const refusal = await attempt(
      db.pool,
      'UPDATE "PaymentReceipt" SET "amount" = 2000000 WHERE "id" = $1',
      [second.id],
    );

    expect(refusal).toMatchObject({ code: SQLSTATE.RESTRICT_VIOLATION });
  });

  it('the total is not writable directly: there is no column', async () => {
    const { payment } = await threeMovements();

    for (const column of ['totalReceived', 'amountReceived', 'balance', 'outstanding']) {
      const refusal = await attempt(
        db.pool,
        `UPDATE "Payment" SET "${column}" = 2500000 WHERE "id" = $1`,
        [payment.id],
      );
      expect(refusal).toMatchObject({ code: SQLSTATE.UNDEFINED_COLUMN });
    }
  });
});
