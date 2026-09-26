import { ConfigService } from '@nestjs/config';
import { PolicyArchiveService } from '../../cms/policy-archive.service';
import type { PolicyPublishPayload } from '../../cms/policy-publish.dto';
import { CorePrismaService } from '../../core/prisma/core-prisma.service';
import { attempt, openCoreTestDatabase, SQLSTATE, type TestDatabase } from './core-test-db';

/**
 * The policy snapshot archive, exercised against a real database.
 *
 * `ContactRequest.consentPolicyPath` records what was consented to as
 * `/legal/privacy` - the document, not the version. This table records the
 * version, as the bytes that were served.
 *
 * The bytes are stored rather than referenced because Sanity resolves a revision
 * through its History API for three days on the current plan, and a consent
 * record has to answer for as long as the consent stands.
 *
 * Every assault is sent as SQL through `pg`. The trigger exists to refuse a
 * caller that did not go through the service, and a test that only ever asks
 * Prisma has not met that caller.
 *
 * Proved by removal: with the trigger dropped in a scratch migration, both
 * refusals read `Received has value: null` - the UPDATE and the DELETE going
 * through. A test that passes against a database where the guarantee was never
 * installed proves nothing about the guarantee.
 */
describe('wave 7 - the policy snapshot archive is append-only, by the database', () => {
  let db: TestDatabase;
  let core: CorePrismaService;

  const RENDERED = '<h1>Politique de confidentialite</h1><p>La version d origine.</p>';

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

  /** One archived revision, with a document id unique to this test. */
  const archive = async (overrides: Partial<Record<string, string>> = {}) => {
    const documentId = overrides['documentId'] ?? `legal-privacy-fr-${Date.now()}-${Math.random()}`;
    const revision = overrides['revision'] ?? 'rev-aaaaaaaa';

    return core.policySnapshot.create({
      data: {
        documentId,
        revision,
        locale: overrides['locale'] ?? 'fr',
        slug: overrides['slug'] ?? 'legal-privacy',
        rendered: overrides['rendered'] ?? RENDERED,
        publishedAt: new Date('2026-09-25T10:00:00.000Z'),
      },
    });
  };

  it('stores the rendered document, so the archive answers without Sanity', async () => {
    const row = await archive();

    const read = await core.policySnapshot.findUniqueOrThrow({ where: { id: row.id } });
    expect(read.rendered).toBe(RENDERED);
    expect(read.slug).toBe('legal-privacy');
    expect(read.locale).toBe('fr');
    // Provenance is kept, and is not what the archive relies on.
    expect(read.revision).toBe('rev-aaaaaaaa');
  });

  it('refuses an UPDATE with restrict_violation, and the row is untouched', async () => {
    const row = await archive();

    const refusal = await attempt(
      db.pool,
      'UPDATE "PolicySnapshot" SET "rendered" = $2 WHERE "id" = $1',
      [row.id, '<h1>Something else entirely</h1>'],
    );

    expect(refusal).toMatchObject({ code: SQLSTATE.RESTRICT_VIOLATION });
    expect(refusal?.message).toMatch(/append-only table PolicySnapshot: UPDATE is refused/);

    const after = await core.policySnapshot.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.rendered).toBe(RENDERED);
  });

  it('refuses a DELETE with restrict_violation, and the row is still there', async () => {
    const row = await archive();

    const refusal = await attempt(db.pool, 'DELETE FROM "PolicySnapshot" WHERE "id" = $1', [
      row.id,
    ]);

    expect(refusal).toMatchObject({ code: SQLSTATE.RESTRICT_VIOLATION });
    expect(refusal?.message).toMatch(/append-only table PolicySnapshot: DELETE is refused/);

    await expect(core.policySnapshot.count({ where: { id: row.id } })).resolves.toBe(1);
  });

  it('archives one row per revision, so a webhook delivered twice does not double', async () => {
    /**
     * Sanity retries a webhook that does not answer, and a retry carries the
     * same document and the same revision. Without the unique index the archive
     * would hold two rows claiming to be the same version, and nothing would
     * say which one a consent record meant.
     */
    // Unique per run. Fixed identifiers made this pass on a first run and fail on
    // every later one, because the row from the previous run was still there and
    // the setup write was the one refused.
    const documentId = `legal-privacy-fr-duplicate-${Date.now()}`;
    const first = await archive({ documentId, revision: 'rev-bbbbbbbb' });

    const refusal = await attempt(
      db.pool,
      `INSERT INTO "PolicySnapshot"
         ("id", "documentId", "revision", "locale", "slug", "rendered", "publishedAt", "archivedAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'fr', 'legal-privacy', $3, NOW(), NOW())`,
      [documentId, 'rev-bbbbbbbb', RENDERED],
    );

    expect(refusal).toMatchObject({
      code: SQLSTATE.UNIQUE_VIOLATION,
      constraint: 'PolicySnapshot_documentId_revision_key',
    });
    await expect(core.policySnapshot.count({ where: { documentId } })).resolves.toBe(1);

    expect(first.revision).toBe('rev-bbbbbbbb');
  });

  it('accepts a new revision of the same document, because that is a correction', async () => {
    // The other direction of the rule above: append-only means a correction is
    // a new row, so the archive must take one.
    const documentId = `legal-privacy-fr-corrected-${Date.now()}`;
    await archive({ documentId, revision: 'rev-cccccccc' });
    await archive({ documentId, revision: 'rev-dddddddd', rendered: '<h1>Corrected</h1>' });

    const rows = await core.policySnapshot.findMany({
      where: { documentId },
      orderBy: { revision: 'asc' },
    });
    expect(rows.map((r) => r.revision)).toEqual(['rev-cccccccc', 'rev-dddddddd']);
  });

  it('answers "which version was current then", which is what consent needs', async () => {
    /**
     * The query a consent record depends on: the newest published revision of a
     * policy in a language, at the moment somebody agreed to it. It is the
     * reason `slug` exists as a column - Sanity's document id is not a name
     * this codebase chose, and consent must be able to ask by policy.
     */
    const slug = `legal-privacy-lookup-${Date.now()}`;
    await archive({ slug, documentId: `${slug}-a`, revision: 'rev-old' });
    const newest = await core.policySnapshot.create({
      data: {
        documentId: `${slug}-b`,
        revision: 'rev-new',
        locale: 'fr',
        slug,
        rendered: '<h1>The current wording</h1>',
        publishedAt: new Date('2026-09-25T18:00:00.000Z'),
      },
    });

    const current = await core.policySnapshot.findFirst({
      where: { slug, locale: 'fr' },
      orderBy: { publishedAt: 'desc' },
    });

    expect(current?.id).toBe(newest.id);
    expect(current?.rendered).toBe('<h1>The current wording</h1>');
  });

  describe('the archive service against a real database', () => {
    /**
     * `PolicyArchiveService` decides "already archived" by reading Prisma's
     * P2002 error. Its unit spec builds that error by hand, which proves the
     * branch and not the shape - the shape is the driver's. This drives the
     * service against the real unique index so the reading is checked against
     * what Prisma actually raises.
     */
    const publish = (overrides: Partial<PolicyPublishPayload> = {}): PolicyPublishPayload => ({
      _id: `legalPolicy-service-${Date.now()}`,
      _rev: 'rev-service-1',
      _type: 'legalPolicy',
      locale: 'fr',
      slug: 'legal-privacy',
      publishedAt: '2026-09-25T10:00:00.000Z',
      body: [
        {
          _type: 'block',
          _key: 'b1',
          style: 'h1',
          children: [{ _type: 'span', _key: 's1', text: 'Confidentialite', marks: [] }],
        },
      ],
      ...overrides,
    });

    it('archives once and reports the repeat as already-archived', async () => {
      const service = new PolicyArchiveService(core);
      const payload = publish();

      const first = await service.archive(payload);
      expect(first).toMatchObject({ status: 'archived', slug: 'legal-privacy', locale: 'fr' });

      // The same delivery again, exactly as a Sanity retry sends it.
      await expect(service.archive(payload)).resolves.toMatchObject({
        status: 'already-archived',
        revision: 'rev-service-1',
      });

      await expect(core.policySnapshot.count({ where: { documentId: payload._id } })).resolves.toBe(
        1,
      );
    });

    it('stores the rendered HTML, which is what the archive answers with', async () => {
      const service = new PolicyArchiveService(core);
      const outcome = await service.archive(publish({ _rev: 'rev-service-2' }));
      if (outcome.status !== 'archived')
        throw new Error(`Expected archived, got ${outcome.status}`);

      const row = await core.policySnapshot.findUniqueOrThrow({ where: { id: outcome.id } });
      expect(row.rendered).toBe('<h1>Confidentialite</h1>');
    });
  });

  describe('a consent record cannot point at a version the archive does not hold', () => {
    /**
     * Wave 7 step 3. `ContactRequest.consentPolicySnapshotId` is a foreign key,
     * so the column cannot record agreement to a revision nobody archived.
     *
     * Sent as SQL, because the guarantee exists for the caller that did not go
     * through the service - and asserted by constraint NAME, so a row refused by
     * a different rule does not pass for this one.
     */
    const insertConsent = (snapshotId: string | null) =>
      attempt(
        db.pool,
        `INSERT INTO "ContactRequest"
           ("id", "name", "email", "subject", "message", "locale", "consentGivenAt",
            "consentPolicyPath", "consentPolicySnapshotId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, 'Consent', 'c@example.test', 'LANDS', 'a message',
                 'fr', now(), '/legal/privacy', $1, now(), now())`,
        [snapshotId],
      );

    it('refuses an id no snapshot carries, by name', async () => {
      const refusal = await insertConsent('00000000-0000-4000-8000-000000000000');

      expect(refusal).toMatchObject({
        code: SQLSTATE.FOREIGN_KEY_VIOLATION,
        constraint: 'ContactRequest_consentPolicySnapshotId_fkey',
      });
    });

    it('accepts an archived revision', async () => {
      const snapshot = await archive({ documentId: `legal-privacy-consent-${Date.now()}` });

      await expect(insertConsent(snapshot.id)).resolves.toBeNull();
    });

    it('accepts null, because a lead is stored before any policy is published', async () => {
      // The other direction, and it is a decision rather than an oversight: the
      // write is the success criterion, and the count of such rows goes out in
      // the daily digest.
      await expect(insertConsent(null)).resolves.toBeNull();
    });
  });

  it('keeps the two locales apart, because they are separate documents', async () => {
    // Document-level internationalisation gives each language its own document
    // and its own revisions. A lookup that ignored locale would hand a French
    // reader the English wording and record that as what they agreed to.
    const slug = `legal-privacy-locales-${Date.now()}`;
    await archive({ slug, documentId: `${slug}-fr`, revision: 'rev-fr', locale: 'fr' });
    await archive({
      slug,
      documentId: `${slug}-en`,
      revision: 'rev-en',
      locale: 'en',
      rendered: '<h1>Privacy policy</h1>',
    });

    const en = await core.policySnapshot.findFirst({ where: { slug, locale: 'en' } });
    expect(en?.rendered).toBe('<h1>Privacy policy</h1>');
    await expect(core.policySnapshot.count({ where: { slug } })).resolves.toBe(2);
  });
});
