import { randomUUID } from 'node:crypto';
import { attempt, openCoreTestDatabase, SQLSTATE, type TestDatabase } from './core-test-db';

/**
 * C28 step 1 - the record of administrative acts is append-only, by the
 * database.
 *
 * Sent as SQL through `pg`: the trigger exists to refuse the caller that does
 * not go through a service. Proved by removal: against the migration without
 * its trigger, the UPDATE and the DELETE both went through and these tests read
 * `Received: null`.
 */
describe('C28 - the record of administrative acts is append-only', () => {
  let db: TestDatabase;

  beforeAll(() => {
    db = openCoreTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  /** One act, on an account id minted by this test. */
  const record = async (reason = 'the client asked, identity checked by phone') => {
    const id = randomUUID();
    await db.pool.query(
      `INSERT INTO "AdministrativeAct"
         ("id", "subjectUserId", "actorUserId", "action", "field", "oldValue", "newValue", "reason")
       VALUES ($1, $2, $3, 'EMAIL_CORRECTION', 'email', 'ada@exampel.com', 'ada@example.com', $4)`,
      [id, randomUUID(), randomUUID(), reason],
    );
    return id;
  };

  const read = async (id: string) =>
    (await db.pool.query('SELECT * FROM "AdministrativeAct" WHERE "id" = $1', [id])).rows;

  it('keeps who, when, why, and the old and new value', async () => {
    const id = await record();
    const [row] = await read(id);
    expect(row).toMatchObject({
      action: 'EMAIL_CORRECTION',
      field: 'email',
      oldValue: 'ada@exampel.com',
      newValue: 'ada@example.com',
      reason: 'the client asked, identity checked by phone',
    });
    expect(row.occurredAt).toBeInstanceOf(Date);
  });

  it('refuses an UPDATE with restrict_violation, and the row is untouched', async () => {
    const id = await record();

    const refusal = await attempt(
      db.pool,
      'UPDATE "AdministrativeAct" SET "newValue" = $2 WHERE "id" = $1',
      [id, 'someone@else.test'],
    );

    expect(refusal).toMatchObject({ code: SQLSTATE.RESTRICT_VIOLATION });
    expect(refusal?.message).toMatch(/append-only table AdministrativeAct: UPDATE is refused/);
    expect((await read(id))[0].newValue).toBe('ada@example.com');
  });

  it('refuses a DELETE with restrict_violation, and the row is still there', async () => {
    const id = await record();

    const refusal = await attempt(db.pool, 'DELETE FROM "AdministrativeAct" WHERE "id" = $1', [id]);

    expect(refusal).toMatchObject({ code: SQLSTATE.RESTRICT_VIOLATION });
    expect(refusal?.message).toMatch(/append-only table AdministrativeAct: DELETE is refused/);
    expect(await read(id)).toHaveLength(1);
  });

  it('refuses an act with a blank reason, by the named constraint', async () => {
    const refusal = await attempt(
      db.pool,
      `INSERT INTO "AdministrativeAct"
         ("id", "subjectUserId", "actorUserId", "action", "field", "reason")
       VALUES ($1, $2, $3, 'EMAIL_CORRECTION', 'email', '   ')`,
      [randomUUID(), randomUUID(), randomUUID()],
    );
    expect(refusal).toMatchObject({
      code: SQLSTATE.CHECK_VIOLATION,
      constraint: 'AdministrativeAct_reason_not_blank',
    });
  });
});
