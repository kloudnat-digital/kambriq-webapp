import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { CONSENT_POLICY_SLUG } from '@kambriq/common';
import { PolicyArchiveService } from '../../cms/policy-archive.service';
import { ContactService } from '../../core/contact/contact.service';
import { CorePrismaService } from '../../core/prisma/core-prisma.service';
import { openCoreTestDatabase, type TestDatabase } from './core-test-db';

/**
 * C41 - a revision published with a future date is not in force.
 *
 * The consent record looked up "the current revision" by the latest
 * `publishedAt`, with no upper bound: a revision dated 19 October, published on
 * 1 October, became what every consent from 1 October was bound to. In force
 * means already published (Visquis, 2 October); future dating stays possible,
 * so the terms can be prepared before they take effect. Against the real core
 * migrations, where the archive is append-only and shared, so each test dates
 * its own rows where nothing else will.
 */
describe('C41 - only a revision already published is in force', () => {
  let db: TestDatabase;
  let core: CorePrismaService;
  let archive: PolicyArchiveService;
  let contact: ContactService;

  beforeAll(async () => {
    db = openCoreTestDatabase();
    core = new CorePrismaService({
      get: (key: string) => (key === 'DATABASE_URL_CORE' ? db.url : undefined),
    } as unknown as ConfigService);
    await core.onModuleInit();
    archive = new PolicyArchiveService(core);
    contact = new ContactService(core, {} as never, {} as never);
  });

  afterAll(async () => {
    await core.onModuleDestroy();
    await db.close();
  });

  const snapshot = (slug: string, locale: string, publishedAt: string) =>
    core.policySnapshot.create({
      data: {
        documentId: `c41-${randomUUID()}`,
        revision: `rev-${randomUUID()}`,
        locale,
        slug,
        rendered: `<p>${publishedAt}</p>`,
        publishedAt: new Date(publishedAt),
      },
    });

  it('binds a consent to the revision in force, never to one dated in the future', async () => {
    // Later than anything else this shared archive will ever hold for the policy.
    const future = await snapshot(CONSENT_POLICY_SLUG, 'en', '2999-01-01T00:00:00Z');

    const bound = await (
      contact as unknown as { currentPolicySnapshotId(l: 'fr' | 'en'): Promise<string | null> }
    ).currentPolicySnapshotId('en');

    expect(bound).not.toBe(future.id);
  });

  it('answers which revision is in force and which comes next', async () => {
    const locale = `c41-${randomUUID().slice(0, 8)}`;
    const past = await snapshot('legal-terms', locale, '2026-09-01T00:00:00Z');
    const later = await snapshot('legal-terms', locale, '2026-10-01T00:00:00Z');
    const upcoming = await snapshot('legal-terms', locale, '2026-10-18T22:00:00Z');

    const at = new Date('2026-10-02T10:00:00Z');
    const standing = await archive.inForce('legal-terms', locale, at);
    expect(standing.inForce?.revision).toBe(later.revision);
    expect(standing.inForce?.rendered).toBe('<p>2026-10-01T00:00:00Z</p>');
    expect(standing.upcoming?.revision).toBe(upcoming.revision);
    expect(past.revision).not.toBe(standing.inForce?.revision);

    // On the 19th the upcoming one is in force, and nothing comes next.
    const after = await archive.inForce('legal-terms', locale, new Date('2026-10-19T00:00:00Z'));
    expect(after.inForce?.revision).toBe(upcoming.revision);
    expect(after.upcoming).toBeNull();
  });

  it('has nothing in force when every revision is dated in the future', async () => {
    const locale = `c41-${randomUUID().slice(0, 8)}`;
    const only = await snapshot('legal-privacy', locale, '2026-10-18T22:00:00Z');
    const standing = await archive.inForce(
      'legal-privacy',
      locale,
      new Date('2026-10-02T10:00:00Z'),
    );
    expect(standing.inForce).toBeNull();
    expect(standing.upcoming?.revision).toBe(only.revision);
  });
});
