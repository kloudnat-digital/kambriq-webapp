import { PaymentChannel, PaymentState } from '@kambriq/common';
import {
  attempt,
  createPaymentFixture,
  openTestDatabase,
  SQLSTATE,
  type TestDatabase,
} from './lands-test-db';

/**
 * A17 / G5.3b / G7.2 - "Rien n'est reecrivable apres coup", exercised.
 *
 * Until this file, the two append-only triggers were text in a migration and
 * one fortuitous observation: G11's own migration tried to UPDATE a receipt's
 * note and was refused. That was the trigger doing its job once, by accident.
 * A property is something that fails on purpose when it stops being true.
 *
 * Each assault is sent as SQL through `pg`, not through Prisma: the trigger's
 * reason for existing is the caller that does not use the service - "a script,
 * a console, or the next developer in a hurry".
 *
 * Proved sharp on 2026-09-09 by dropping each trigger in a scratch migration
 * and watching its tests fail with `Received: null` - the UPDATE went through.
 * See `docs/ops/registre-chantiers.md`, A17.
 */
describe('A17 - the ledger and the audit trail are append-only, by the database', () => {
  let db: TestDatabase;

  beforeAll(() => {
    db = openTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  const AMOUNT = 500_000n;

  const insertReceipt = async (paymentId: string) =>
    db.prisma.paymentReceipt.create({
      data: {
        paymentId,
        amount: AMOUNT,
        currency: 'XAF',
        channel: PaymentChannel.VIR,
        receivedAt: new Date('2026-09-01T00:00:00Z'),
        recordedBy: 'a17-recorder',
        evidenceUrl: 'payments/a17/proof.pdf',
      },
    });

  const insertTransition = async (paymentId: string) =>
    db.prisma.paymentTransition.create({
      data: {
        paymentId,
        fromState: PaymentState.EN_VERIFICATION,
        toState: PaymentState.PARTIELLEMENT_RECU,
        actorUserId: 'a17-actor',
        reason: 'original reason',
      },
    });

  // ----- PaymentReceipt ----- //

  describe('PaymentReceipt_append_only', () => {
    it('refuses an UPDATE with restrict_violation, and the row is untouched', async () => {
      const payment = await createPaymentFixture(db.prisma);
      const receipt = await insertReceipt(payment.id);

      const refusal = await attempt(
        db.pool,
        'UPDATE "PaymentReceipt" SET "amount" = "amount" + 1 WHERE "id" = $1',
        [receipt.id],
      );

      expect(refusal).toMatchObject({ code: SQLSTATE.RESTRICT_VIOLATION });
      expect(refusal?.message).toMatch(/append-only table PaymentReceipt: UPDATE is refused/);

      const after = await db.prisma.paymentReceipt.findUniqueOrThrow({ where: { id: receipt.id } });
      expect(after.amount).toBe(AMOUNT);
    });

    it('refuses a DELETE with restrict_violation, and the row is still there', async () => {
      const payment = await createPaymentFixture(db.prisma);
      const receipt = await insertReceipt(payment.id);

      const refusal = await attempt(db.pool, 'DELETE FROM "PaymentReceipt" WHERE "id" = $1', [
        receipt.id,
      ]);

      expect(refusal).toMatchObject({ code: SQLSTATE.RESTRICT_VIOLATION });
      expect(refusal?.message).toMatch(/append-only table PaymentReceipt: DELETE is refused/);

      await expect(db.prisma.paymentReceipt.count({ where: { id: receipt.id } })).resolves.toBe(1);
    });

    it('refuses the edit even when it is the note, not the money', async () => {
      // G11's migration tried exactly this and was refused. A schema migration
      // is not an exemption, and neither is "it is only a comment field".
      const payment = await createPaymentFixture(db.prisma);
      const receipt = await insertReceipt(payment.id);

      const refusal = await attempt(
        db.pool,
        `UPDATE "PaymentReceipt" SET "note" = 'annotated after the fact' WHERE "id" = $1`,
        [receipt.id],
      );

      expect(refusal).toMatchObject({ code: SQLSTATE.RESTRICT_VIOLATION });
    });

    it('still accepts an INSERT - a correction is a new row', async () => {
      // The trigger is BEFORE UPDATE OR DELETE, not a lock on the table. If it
      // refused inserts too, the ledger could never receive a correction, and
      // the sharpness of the two tests above would be a side effect of a
      // table nobody can write to.
      const payment = await createPaymentFixture(db.prisma);
      const original = await insertReceipt(payment.id);

      const correction = await db.prisma.paymentReceipt.create({
        data: {
          paymentId: payment.id,
          amount: -AMOUNT,
          currency: 'XAF',
          channel: PaymentChannel.VIR,
          receivedAt: new Date('2026-09-01T00:00:00Z'),
          recordedBy: 'a17-corrector',
          evidenceUrl: 'payments/a17/statement.pdf',
          correctsId: original.id,
          note: 'keyed twice',
        },
      });

      expect(correction.correctsId).toBe(original.id);
      await expect(
        db.prisma.paymentReceipt.count({ where: { paymentId: payment.id } }),
      ).resolves.toBe(2);
    });
  });

  // ----- PaymentTransition ----- //

  describe('PaymentTransition_append_only', () => {
    it('refuses an UPDATE with restrict_violation, and the row is untouched', async () => {
      const payment = await createPaymentFixture(db.prisma);
      const transition = await insertTransition(payment.id);

      const refusal = await attempt(
        db.pool,
        `UPDATE "PaymentTransition" SET "reason" = 'rewritten' WHERE "id" = $1`,
        [transition.id],
      );

      expect(refusal).toMatchObject({ code: SQLSTATE.RESTRICT_VIOLATION });
      expect(refusal?.message).toMatch(/append-only table PaymentTransition: UPDATE is refused/);

      const after = await db.prisma.paymentTransition.findUniqueOrThrow({
        where: { id: transition.id },
      });
      expect(after.reason).toBe('original reason');
    });

    it('refuses a DELETE with restrict_violation, and the row is still there', async () => {
      const payment = await createPaymentFixture(db.prisma);
      const transition = await insertTransition(payment.id);

      const refusal = await attempt(db.pool, 'DELETE FROM "PaymentTransition" WHERE "id" = $1', [
        transition.id,
      ]);

      expect(refusal).toMatchObject({ code: SQLSTATE.RESTRICT_VIOLATION });
      expect(refusal?.message).toMatch(/append-only table PaymentTransition: DELETE is refused/);

      await expect(
        db.prisma.paymentTransition.count({ where: { id: transition.id } }),
      ).resolves.toBe(1);
    });

    it('refuses to rewrite who did it', async () => {
      // The audit trail's "qui". A trail whose actor can be changed after the
      // fact answers the question a dispute asks with whatever was written last.
      const payment = await createPaymentFixture(db.prisma);
      const transition = await insertTransition(payment.id);

      const refusal = await attempt(
        db.pool,
        `UPDATE "PaymentTransition" SET "actorUserId" = 'somebody-else' WHERE "id" = $1`,
        [transition.id],
      );

      expect(refusal).toMatchObject({ code: SQLSTATE.RESTRICT_VIOLATION });
    });
  });

  // ----- PaymentReminder (G6) ----- //

  describe('PaymentReminder triggers, the same class from G6', () => {
    const insertReminder = async (paymentId: string) =>
      db.prisma.paymentReminder.create({
        data: { paymentId, offsetDays: 7, deadlineAt: new Date('2026-10-01T00:00:00Z') },
      });

    it('refuses an UPDATE', async () => {
      const payment = await createPaymentFixture(db.prisma);
      const reminder = await insertReminder(payment.id);

      const refusal = await attempt(
        db.pool,
        'UPDATE "PaymentReminder" SET "offsetDays" = 1 WHERE "id" = $1',
        [reminder.id],
      );

      expect(refusal).toMatchObject({ code: SQLSTATE.RAISE_EXCEPTION });
      expect(refusal?.message).toMatch(/PaymentReminder is append-only: UPDATE is refused/);
    });

    it('refuses a DELETE', async () => {
      const payment = await createPaymentFixture(db.prisma);
      const reminder = await insertReminder(payment.id);

      const refusal = await attempt(db.pool, 'DELETE FROM "PaymentReminder" WHERE "id" = $1', [
        reminder.id,
      ]);

      expect(refusal).toMatchObject({ code: SQLSTATE.RAISE_EXCEPTION });
      expect(refusal?.message).toMatch(/PaymentReminder is append-only: DELETE is refused/);
    });
  });
});
