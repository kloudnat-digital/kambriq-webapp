import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { PaymentChannel, PaymentState } from '@kambriq/common';
import {
  attempt as coreAttempt,
  openCoreTestDatabase,
  SQLSTATE,
  type TestDatabase as CoreDatabase,
} from './core-test-db';
import {
  attempt,
  createPaymentFixture,
  openTestDatabase,
  type TestDatabase as LandsDatabase,
} from './lands-test-db';

/**
 * A73 - an append-only table refuses TRUNCATE, not only UPDATE and DELETE.
 *
 * A row-level trigger does not fire on TRUNCATE, so each of these tables could
 * be emptied in one statement while every UPDATE and DELETE test stayed green.
 * Each table now carries a statement-level `BEFORE TRUNCATE` trigger on
 * `kambriq_append_only()`. Proved by removal: before the migration, each
 * TRUNCATE below went through (`Received: null`).
 *
 * The five tables are every table in the four databases whose triggers refuse
 * an UPDATE or a DELETE, read from `pg_trigger`.
 */
/** A direct TRUNCATE names its table; a CASCADE is refused by whichever guarded table fires first. */
const refused = (table?: string) =>
  expect.objectContaining({
    code: SQLSTATE.RESTRICT_VIOLATION,
    message: expect.stringMatching(
      new RegExp(`append-only table ${table ?? '\\w+'}: TRUNCATE is refused`),
    ),
  });

/**
 * Every table whose own trigger refuses an UPDATE or a DELETE, against the
 * tables that also refuse a TRUNCATE. Read from the catalog, so a sixth
 * append-only table is held to this without anybody listing it.
 */
const uncovered = async (pool: Pool) => {
  const { rows } = await pool.query<{ table: string; truncate: boolean }>(`
    SELECT c.relname AS "table", bool_or((t.tgtype & 32) > 0) AS "truncate"
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE NOT t.tgisinternal
     GROUP BY c.relname
    HAVING bool_or((t.tgtype & 8) > 0 OR (t.tgtype & 16) > 0)`);
  return {
    tables: rows.map((r) => r.table).sort(),
    uncovered: rows.filter((r) => !r.truncate).map((r) => r.table),
  };
};

describe('A73 - core: the append-only tables refuse TRUNCATE', () => {
  let db: CoreDatabase;

  beforeAll(() => {
    db = openCoreTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  const count = async (table: string, id: string) =>
    Number(
      (await db.pool.query(`SELECT count(*) FROM "${table}" WHERE "id" = $1`, [id])).rows[0].count,
    );

  it('refuses TRUNCATE "PolicySnapshot", which consents reference, so with CASCADE', async () => {
    // Without CASCADE the foreign key from ContactRequest refuses first; with it,
    // the archive and every consent pointing at it would go together.
    const id = randomUUID();
    await db.pool.query(
      `INSERT INTO "PolicySnapshot" ("id", "documentId", "revision", "locale", "slug", "rendered", "publishedAt")
       VALUES ($1, $2, 'rev-a73', 'fr', 'legal-privacy', '<p>a73</p>', NOW())`,
      [id, `a73-${id}`],
    );
    const refusal = await coreAttempt(db.pool, 'TRUNCATE "PolicySnapshot" CASCADE');
    expect(refusal).toEqual(refused());
    expect(await count('PolicySnapshot', id)).toBe(1);
  });

  it('every table that refuses UPDATE or DELETE also refuses TRUNCATE', async () => {
    const found = await uncovered(db.pool);
    expect(found.tables).toEqual(['AdministrativeAct', 'PolicySnapshot']);
    expect(found.uncovered).toEqual([]);
  });

  it('refuses TRUNCATE "AdministrativeAct", and the row is still there', async () => {
    const id = randomUUID();
    await db.pool.query(
      `INSERT INTO "AdministrativeAct" ("id", "subjectUserId", "actorUserId", "action", "field", "reason")
       VALUES ($1, $2, $3, 'A73', 'email', 'a73 proof')`,
      [id, randomUUID(), randomUUID()],
    );
    const refusal = await coreAttempt(db.pool, 'TRUNCATE "AdministrativeAct"');
    expect(refusal).toEqual(refused('AdministrativeAct'));
    expect(await count('AdministrativeAct', id)).toBe(1);
  });
});

describe('A73 - lands: the payment ledger, its audit trail and its reminders refuse TRUNCATE', () => {
  let db: LandsDatabase;

  beforeAll(() => {
    db = openTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  /** A payment carrying one row in each append-only table. */
  const ledger = async () => {
    const payment = await createPaymentFixture(db.prisma);
    const receipt = await db.prisma.paymentReceipt.create({
      data: {
        paymentId: payment.id,
        amount: 500_000n,
        currency: 'XAF',
        channel: PaymentChannel.VIR,
        receivedAt: new Date('2026-09-01T00:00:00Z'),
        recordedBy: 'a73-recorder',
        evidenceUrl: 'payments/a73/proof.pdf',
      },
    });
    const transition = await db.prisma.paymentTransition.create({
      data: {
        paymentId: payment.id,
        fromState: PaymentState.EN_VERIFICATION,
        toState: PaymentState.PARTIELLEMENT_RECU,
        actorUserId: 'a73-actor',
        reason: 'a73 proof',
      },
    });
    const reminder = await db.prisma.paymentReminder.create({
      data: { paymentId: payment.id, offsetDays: 7, deadlineAt: new Date('2026-10-01T00:00:00Z') },
    });
    return { payment, receipt, transition, reminder };
  };

  const still = async (l: Awaited<ReturnType<typeof ledger>>) => [
    await db.prisma.paymentReceipt.count({ where: { id: l.receipt.id } }),
    await db.prisma.paymentTransition.count({ where: { id: l.transition.id } }),
    await db.prisma.paymentReminder.count({ where: { id: l.reminder.id } }),
  ];

  it('every table that refuses UPDATE or DELETE also refuses TRUNCATE', async () => {
    const found = await uncovered(db.pool);
    expect(found.tables).toEqual(['PaymentReceipt', 'PaymentReminder', 'PaymentTransition']);
    expect(found.uncovered).toEqual([]);
  });

  it('refuses TRUNCATE "PaymentTransition"', async () => {
    const l = await ledger();
    expect(await attempt(db.pool, 'TRUNCATE "PaymentTransition"')).toEqual(
      refused('PaymentTransition'),
    );
    expect(await still(l)).toEqual([1, 1, 1]);
  });

  it('refuses TRUNCATE "PaymentReminder"', async () => {
    const l = await ledger();
    expect(await attempt(db.pool, 'TRUNCATE "PaymentReminder"')).toEqual(
      refused('PaymentReminder'),
    );
    expect(await still(l)).toEqual([1, 1, 1]);
  });

  it('refuses TRUNCATE "PaymentReceipt", which the audit trail references, so with CASCADE', async () => {
    // Without CASCADE the foreign key from PaymentTransition refuses first, and
    // that refusal is not the guarantee under test.
    const l = await ledger();
    expect(await attempt(db.pool, 'TRUNCATE "PaymentReceipt" CASCADE')).toEqual(refused());
    expect(await still(l)).toEqual([1, 1, 1]);
  });

  it('refuses a TRUNCATE of "Payment" that cascades into the ledger', async () => {
    const l = await ledger();
    expect(await attempt(db.pool, 'TRUNCATE "Payment" CASCADE')).toEqual(
      expect.objectContaining({ code: SQLSTATE.RESTRICT_VIOLATION }),
    );
    expect(await still(l)).toEqual([1, 1, 1]);
    expect(await db.prisma.payment.count({ where: { id: l.payment.id } })).toBe(1);
  });
});
