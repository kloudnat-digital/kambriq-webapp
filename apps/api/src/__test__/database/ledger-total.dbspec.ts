import { PaymentChannel, sumReceipts } from '@kambriq/common';
import {
  attempt,
  createPaymentFixture,
  openTestDatabase,
  SQLSTATE,
  type TestDatabase,
} from './lands-test-db';

/**
 * G5, against the real database - "L'argent n'est jamais un champ modifiable".
 *
 * `payments.service.spec.ts` proves the service appends and sums. It cannot
 * prove what the database does when something tries to edit a line or write a
 * total, because a mock has no triggers and every column you name. This does.
 *
 * Three movements: two encaissements and one correction. The total is a sum
 * over the three; the original line is still there, byte for byte; and the
 * total has nowhere to be written.
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
    // The correction: its own author, its own reason, a signed amount, and a
    // pointer at the line it corrects. It appends.
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

    // The same summation the service uses, over the rows the database holds.
    expect(sumReceipts(lines)).toBe(2_500_000n);

    // And the database agrees with it, so the two cannot drift.
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

    // The correction carries its own reason and its own author, and points at
    // the original rather than replacing it.
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
