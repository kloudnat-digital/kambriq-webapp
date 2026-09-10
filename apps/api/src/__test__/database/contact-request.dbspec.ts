import { ConfigService } from '@nestjs/config';
import { ContactSubject, EmailService } from '@kambriq/common';
import { ContactService } from '../../core/contact/contact.service';
import { CorePrismaService } from '../../core/prisma/core-prisma.service';
import { attempt, openCoreTestDatabase, SQLSTATE, type TestDatabase } from './core-test-db';

/**
 * L1 - a contact request, stored in a real database.
 *
 * The service runs unchanged against a `CorePrismaService` pointed at the test
 * database; only the things that are not the database are mocked - the email
 * queue and the configuration. So the row this asserts on is a row Postgres
 * accepted, with the columns and constraints the migration declares, rather
 * than a call recorded on a mock.
 *
 * That distinction is the reason this file exists. Until it did, every
 * assertion about persistence in this repository was an assertion about what a
 * mocked Prisma client was asked to do.
 */
describe('L1 - the contact request reaches the database', () => {
  let db: TestDatabase;
  let core: CorePrismaService;
  let service: ContactService;
  let queued: Array<{ to: string; template: string; lang: string }>;

  const INBOX = 'backoffice@contact.test';

  beforeAll(async () => {
    db = openCoreTestDatabase();

    core = new CorePrismaService({
      get: (key: string) => (key === 'DATABASE_URL_CORE' ? db.url : undefined),
    } as unknown as ConfigService);
    await core.onModuleInit();
  });

  afterAll(async () => {
    await core.onModuleDestroy();
    await db.close();
  });

  beforeEach(() => {
    queued = [];
    const email = {
      send: jest.fn(async (payload: { to: string; template: string; lang: string }) => {
        queued.push(payload);
      }),
    } as unknown as EmailService;

    const config = {
      get: (key: string, fallback?: string) => {
        if (key === 'CONTACT_INBOX_EMAIL') return INBOX;
        if (key === 'CONTACT_BACKOFFICE_LOCALE') return 'fr';
        return fallback;
      },
    } as unknown as ConfigService;

    service = new ContactService(core, email, config);
  });

  const valid = (over: Partial<Parameters<ContactService['submit']>[0]> = {}) => ({
    name: 'Amina Nkolo',
    email: `prospect-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`,
    phone: '+33 6 12 34 56 78',
    subject: ContactSubject.LANDS,
    message: 'Je cherche une parcelle titree dans le Littoral. Quelles sont vos disponibilites ?',
    locale: 'fr' as const,
    consent: true,
    consentPolicyPath: '/legal/privacy',
    ...over,
  });

  it('stores the request, with its consent timestamp, and the row is really there', async () => {
    const before = new Date();

    const { id, reference } = await service.submit(valid());

    // Read back from the database through a second client, not from the return
    // value: what the service says it wrote and what Postgres holds are two
    // different claims.
    const { rows } = await db.pool.query('SELECT * FROM "ContactRequest" WHERE "id" = $1', [id]);
    expect(rows).toHaveLength(1);
    const row = rows[0];

    expect(row.name).toBe('Amina Nkolo');
    expect(row.subject).toBe('LANDS');
    expect(row.locale).toBe('fr');
    expect(row.status).toBe('NEW');
    expect(row.phone).toBe('+33 6 12 34 56 78');

    // The column is there and holds something.
    expect(row.consentGivenAt).toBeInstanceOf(Date);

    /**
     * The **instant** is asserted through Prisma, not through `pg`.
     *
     * The column is `TIMESTAMP(3)` - without a time zone, which is what Prisma
     * maps `DateTime` to and what every other table in this repo uses. Prisma
     * writes and reads it as UTC; `node-postgres` parses the same column in the
     * process's local zone. On this machine (UTC+2) the two therefore disagree
     * by exactly 7 200 000 ms, and the first version of this test read the
     * `pg` value and failed by that amount.
     *
     * Nothing is wrong with the stored value. What is worth remembering is that
     * a raw-SQL read of any timestamp in this schema is offset by the reader's
     * zone, so a script that compares one against `Date.now()` will be wrong by
     * a whole number of hours and will look like a clock-skew bug.
     */
    const stored = await core.contactRequest.findUniqueOrThrow({ where: { id } });
    expect(stored.consentGivenAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(stored.consentGivenAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);

    // And what was consented to, so the row can say what somebody agreed to.
    expect(row.consentPolicyPath).toBe('/legal/privacy');

    expect(reference).toMatch(/^KBQ-C-[0-9A-F]{8}$/);
  });

  it('the consent column cannot be talked round - the database refuses a row without it', async () => {
    // The checkbox can be bypassed and the DTO can be gone round. This is the
    // layer that cannot: NOT NULL is a property of the table.
    const refusal = await attempt(
      db.pool,
      `INSERT INTO "ContactRequest"
         ("id", "name", "email", "subject", "message", "locale", "consentPolicyPath", "updatedAt")
       VALUES (gen_random_uuid()::text, 'No Consent', 'x@example.test', 'OTHER',
               'a message long enough', 'fr', '/legal/privacy', now())`,
    );

    expect(refusal).toMatchObject({ code: SQLSTATE.NOT_NULL_VIOLATION });
    expect(refusal?.message).toMatch(/consentGivenAt/);
  });

  it('the database refuses a blank name, email or message', async () => {
    for (const [column, value] of [
      ['name', ''],
      ['email', '   '],
      ['message', ''],
    ] as const) {
      const row: Record<string, string> = {
        name: 'Someone',
        email: 'someone@example.test',
        message: 'a message long enough to pass',
      };
      row[column] = value;

      const refusal = await attempt(
        db.pool,
        `INSERT INTO "ContactRequest"
           ("id", "name", "email", "subject", "message", "locale", "consentGivenAt",
            "consentPolicyPath", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, 'OTHER', $3, 'fr', now(), '/legal/privacy', now())`,
        [row.name, row.email, row.message],
      );

      expect(refusal).toMatchObject({
        code: SQLSTATE.CHECK_VIOLATION,
        constraint: 'ContactRequest_has_content',
      });
    }
  });

  it('the database refuses a locale the site is not published in', async () => {
    // A row carrying 'de' would be acknowledged in the fallback language with
    // nothing anywhere saying why.
    const refusal = await attempt(
      db.pool,
      `INSERT INTO "ContactRequest"
         ("id", "name", "email", "subject", "message", "locale", "consentGivenAt",
          "consentPolicyPath", "updatedAt")
       VALUES (gen_random_uuid()::text, 'Someone', 'someone@example.test', 'OTHER',
               'a message long enough', 'de', now(), '/legal/privacy', now())`,
    );

    expect(refusal).toMatchObject({
      code: SQLSTATE.CHECK_VIOLATION,
      constraint: 'ContactRequest_locale_supported',
    });
  });

  it('a request with no consent is refused before anything is written', async () => {
    const email = `no-consent-${Date.now()}@example.test`;

    await expect(
      service.submit(valid({ email, consent: false as unknown as true })),
    ).rejects.toThrow(/without consent/);

    const { rows } = await db.pool.query(
      'SELECT count(*)::int AS n FROM "ContactRequest" WHERE "email" = $1',
      [email],
    );
    expect(rows[0].n).toBe(0);
  });

  // ----- the digest, against real rows ----- //

  it('the daily digest counts rows in the 48-hour window, and only those', async () => {
    const tag = `digest-${Date.now()}`;
    await db.pool.query('DELETE FROM "ContactRequest"');

    // One inside the window, one outside it, written with explicit timestamps
    // so the boundary is exercised rather than assumed.
    for (const [hoursAgo, name] of [
      [1, `${tag}-recent`],
      [70, `${tag}-old`],
    ] as const) {
      await db.pool.query(
        `INSERT INTO "ContactRequest"
           ("id", "name", "email", "subject", "message", "locale", "consentGivenAt",
            "consentPolicyPath", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, 'p@example.test', 'LANDS', 'a message', 'fr',
                 now(), '/legal/privacy', now() - ($2 || ' hours')::interval, now())`,
        [name, String(hoursAgo)],
      );
    }

    const result = await service.sendDailyDigest();

    expect(result.count).toBe(1);
    // Both rows are still awaiting a reply, so `pending` is not the same number
    // as the window count - a digest that conflated them would hide a backlog.
    expect(result.pending).toBe(2);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ to: INBOX, template: 'contactDigest' });
  });

  it('the digest is sent when the count is zero - that is the whole point', async () => {
    await db.pool.query('DELETE FROM "ContactRequest"');

    const result = await service.sendDailyDigest();

    expect(result.count).toBe(0);
    // An alert would have stayed silent here, and silence is what this exists
    // to abolish: a digest that always arrives makes its own absence the alarm.
    expect(queued).toHaveLength(1);
    expect(queued[0].template).toBe('contactDigest');
  });
});
