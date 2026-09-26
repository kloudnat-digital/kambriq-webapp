import {
  attempt,
  createPaymentFixture,
  openTestDatabase,
  SQLSTATE,
  type TestDatabase,
} from './lands-test-db';

/**
 * G20 - a payment states what it pays for, and a reservation holds one live
 * payment per purpose. Asserted against the real migrations, with the writes
 * sent as SQL: the guarantees exist for the caller that does not go through
 * the service.
 */
describe('G20 - the purpose of a payment', () => {
  let db: TestDatabase;

  beforeAll(() => {
    db = openTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  const insert = (reservationId: string, purpose: string | null, state = 'INITIE') =>
    attempt(
      db.pool,
      purpose === null
        ? `INSERT INTO "Payment" (id, "reservationId", currency, "amountDue", state, "updatedAt")
           VALUES (gen_random_uuid(), $1, 'XAF', 1000, $2::"PaymentState", now())`
        : `INSERT INTO "Payment" (id, "reservationId", currency, "amountDue", state, purpose, "updatedAt")
           VALUES (gen_random_uuid(), $1, 'XAF', 1000, $2::"PaymentState", $3::"PaymentPurpose", now())`,
      purpose === null ? [reservationId, state] : [reservationId, state, purpose],
    );

  it('refuses a payment that does not say what it pays for: the default is gone', async () => {
    const { reservationId } = await createPaymentFixture(db.prisma, { state: 'ANNULE' as never });
    expect(await insert(reservationId, null)).toMatchObject({ code: SQLSTATE.NOT_NULL_VIOLATION });
  });

  it('refuses a second live deposit beside a live one', async () => {
    const { reservationId } = await createPaymentFixture(db.prisma);
    expect(await insert(reservationId, 'ACOMPTE')).toMatchObject({
      code: SQLSTATE.UNIQUE_VIOLATION,
      constraint: 'Payment_one_live_per_purpose',
    });
  });

  it('accepts a balance beside a live deposit - a different purpose', async () => {
    const { reservationId } = await createPaymentFixture(db.prisma);
    expect(await insert(reservationId, 'SOLDE')).toBeNull();
  });

  it('accepts a fresh deposit once the previous one ended where money never arrived', async () => {
    const { reservationId } = await createPaymentFixture(db.prisma, { state: 'ANNULE' as never });
    expect(await insert(reservationId, 'ACOMPTE')).toBeNull();
  });
});
