import { randomUUID } from 'node:crypto';
import { CandidateStatus } from '@kambriq/common/constants/kbs';
import {
  PUBLIC_DIRECTORY_ENTRY_KEYS,
  toPublicDirectoryEntry,
  type PublicDirectoryEntry,
} from '../../kamnet/agents/public-listing';
import { openCoreTestDatabase, type TestDatabase } from './core-test-db';
import { openKbsTestDatabase, type KbsTestDatabase } from './kbs-test-db';
import { openKamnetTestDatabase, type KamnetTestDatabase } from './kamnet-test-db';

/**
 * P11 - who appears in the public directory of certified agents.
 *
 * ---------------------------------------------------------------------------
 * Three databases, because the decision is spread across three
 * ---------------------------------------------------------------------------
 * Consent and suspension are columns on `KamnetAgent` in **kamnet**; the name,
 * city and country a reader actually sees are on `User` and `UserProfile` in
 * **core**; the certificate that makes the person an agent at all is in
 * **kbs**. There are no foreign keys between them, so nothing in the schema
 * enforces that the three agree - which is precisely why the rule is worth a
 * test against real rows rather than a unit test over three literals.
 *
 * This is the first `*.dbspec.ts` to open more than one database. It follows
 * `kca1-replay.dbspec.ts` and truncates NOTHING: every id is a `randomUUID`,
 * so fixtures cannot collide with each other or with another suite's rows.
 * Truncating `User` here would cascade-delete the rows `contact-request` and
 * `purge-deletes-objects` create in the same database.
 *
 * ---------------------------------------------------------------------------
 * One control, and four fixtures that differ from it in exactly one thing
 * ---------------------------------------------------------------------------
 * The brief asks for three separate fixtures "because one combined fixture
 * passes when only one exclusion works". The same trap has a second half: a
 * suite of nothing but exclusions passes completely if the projection never
 * lists anybody at all. So `listed` is here as the control, asserted first, and
 * every other fixture is that same fixture with ONE field changed. When
 * `suspended` is excluded, suspension is the only thing that can have excluded
 * it.
 *
 * `revoked` and `expired` are separate rather than one "invalid certificate"
 * case, because they fail through different fields - `revokedAt` and
 * `validUntil` - and a predicate that read only one of them would pass the
 * other. That exact defect is on record: `verifyCertificate` stored `revokedAt`
 * and ignored it, so a withdrawn certificate answered `valid: true` until the
 * day it expired.
 */
type Fixture = {
  readonly userId: string;
  readonly candidateId: string;
  readonly agentId: string;
  readonly kcaNumber: string;
};

type FixtureOptions = {
  readonly consented: boolean;
  readonly suspended?: boolean;
  readonly revoked?: boolean;
  readonly expired?: boolean;
};

const YEAR = 365 * 24 * 60 * 60 * 1000;

describe('P11 - the public directory lists only agents who may be listed', () => {
  let kamnet: KamnetTestDatabase;
  let core: TestDatabase;
  let kbs: KbsTestDatabase;

  beforeAll(() => {
    kamnet = openKamnetTestDatabase();
    core = openCoreTestDatabase();
    kbs = openKbsTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await Promise.all([kamnet?.close(), core?.close(), kbs?.close()]);
  });

  /**
   * One agent, written across all three databases.
   *
   * The certificate dates are chosen so that each state fails through its own
   * field and nothing else: `expired` keeps `revokedAt` null, and `revoked`
   * keeps `validUntil` in the future.
   */
  const createFixture = async (options: FixtureOptions): Promise<Fixture> => {
    const userId = randomUUID();
    const candidateId = randomUUID();
    const agentId = randomUUID();
    const kcaNumber = `KCA-P11-${randomUUID().slice(0, 8)}`;
    const now = Date.now();

    await core.prisma.user.create({
      data: {
        id: userId,
        email: `p11-${userId}@example.test`,
        firstName: 'Amina',
        lastName: 'Nkolo',
      },
    });
    await core.prisma.userProfile.create({
      data: { userId, city: 'Douala', country: 'CM', avatarUrl: 'avatars/p11.png' },
    });

    await kbs.prisma.kbsCandidate.create({
      data: { id: candidateId, userId, status: CandidateStatus.CERTIFIED },
    });
    await kbs.prisma.kbsCertificate.create({
      data: {
        candidateId,
        kcaNumber,
        issueDate: new Date(now - 2 * YEAR),
        validUntil: options.expired ? new Date(now - YEAR) : new Date(now + YEAR),
        revokedAt: options.revoked ? new Date(now - 1_000) : null,
      },
    });

    await kamnet.prisma.kamnetAgent.create({
      data: {
        id: agentId,
        userId,
        kcaNumber,
        agentCode: `AGT-P11-${agentId.slice(0, 8)}`,
        publicListingConsentAt: options.consented ? new Date(now - 1_000) : null,
        suspendedAt: options.suspended ? new Date(now - 1_000) : null,
      },
    });

    return { userId, candidateId, agentId, kcaNumber };
  };

  /**
   * The rule, applied to rows read back out of the three databases.
   *
   * Everything is read rather than remembered from the write: a column with the
   * wrong nullability, or a timestamp Postgres rounded, would otherwise be
   * invisible to this test.
   */
  /**
   * The newest certificate of a candidate, in the shape the service hands the
   * projection - owner included.
   *
   * `KbsCertificate` carries `candidateId`, not `userId`, so the owner is read
   * through the relation exactly as `findNewestCertificateFactsForUsers` reads it.
   */
  const certificateOf = async (candidateId: string) => {
    const row = await kbs.prisma.kbsCertificate.findFirst({
      where: { candidateId },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        kcaNumber: true,
        issueDate: true,
        validUntil: true,
        revokedAt: true,
        candidate: { select: { userId: true } },
      },
    });

    if (!row) return null;
    const { candidate, ...facts } = row;
    return { ownerUserId: candidate.userId, ...facts };
  };

  const entryFor = async (
    fixture: Fixture,
    /** Whose certificate to pair with this agent. Defaults to their own. */
    certificateFrom: Fixture = fixture,
  ): Promise<PublicDirectoryEntry | null> => {
    const agent = await kamnet.prisma.kamnetAgent.findUniqueOrThrow({
      where: { id: fixture.agentId },
      select: { userId: true, publicListingConsentAt: true, suspendedAt: true },
    });
    const user = await core.prisma.user.findUnique({
      where: { id: fixture.userId },
      select: {
        firstName: true,
        lastName: true,
        isActive: true,
        deletedAt: true,
        profile: { select: { city: true, country: true, avatarUrl: true } },
      },
    });
    const certificate = await certificateOf(certificateFrom.candidateId);

    return toPublicDirectoryEntry(agent, user, certificate);
  };

  // ----- the control: without this, every exclusion below is vacuous -----

  it('lists an agent who consented, is not suspended and holds a valid certificate', async () => {
    const listed = await createFixture({ consented: true });

    const entry = await entryFor(listed);

    expect(entry).not.toBeNull();
    expect(entry?.kcaNumber).toBe(listed.kcaNumber);
    expect(entry?.firstName).toBe('Amina');
    expect(entry?.city).toBe('Douala');
    expect(entry?.country).toBe('CM');
  });

  // ----- the three exclusions the brief names, each proved on its own -----

  it('excludes an agent who never consented, everything else being equal', async () => {
    const noConsent = await createFixture({ consented: false });

    expect(await entryFor(noConsent)).toBeNull();
  });

  it('excludes a suspended agent, everything else being equal', async () => {
    const suspended = await createFixture({ consented: true, suspended: true });

    expect(await entryFor(suspended)).toBeNull();
  });

  it('excludes an agent whose certificate was revoked, though it has not expired', async () => {
    const revoked = await createFixture({ consented: true, revoked: true });

    expect(await entryFor(revoked)).toBeNull();
  });

  it('excludes an agent whose certificate expired, though it was never revoked', async () => {
    const expired = await createFixture({ consented: true, expired: true });

    expect(await entryFor(expired)).toBeNull();
  });

  // ----- the shape: asserted by absence, not by presence -----

  /**
   * A projection that spread the whole record would carry the seven expected
   * fields too, and pass any test that only checked they were there.
   */
  it('publishes none of the agent record beyond the seven public fields', async () => {
    const listed = await createFixture({ consented: true });

    const entry = await entryFor(listed);

    expect(entry).not.toBeNull();
    for (const forbidden of [
      'salesCount',
      'referralCount',
      'sponsor',
      'sponsorId',
      'tier',
      'agentCode',
      'bio',
      'email',
      'phone',
      'address',
      'userId',
      'id',
      'publicListingConsentAt',
      'suspendedAt',
    ]) {
      expect(entry).not.toHaveProperty(forbidden);
    }
    expect(Object.keys(entry as object).sort()).toEqual([...PUBLIC_DIRECTORY_ENTRY_KEYS].sort());
  });

  // ----- withdrawal takes effect on the next read -----

  it('drops an agent from the listing as soon as consent is withdrawn', async () => {
    const listed = await createFixture({ consented: true });
    expect(await entryFor(listed)).not.toBeNull();

    await kamnet.prisma.kamnetAgent.update({
      where: { id: listed.agentId },
      data: { publicListingConsentAt: null },
    });

    expect(await entryFor(listed)).toBeNull();
  });

  // ----- beyond the brief, and reported as such -----

  it('excludes an agent whose account was deactivated', async () => {
    const deactivated = await createFixture({ consented: true });

    await core.prisma.user.update({
      where: { id: deactivated.userId },
      data: { isActive: false },
    });

    expect(await entryFor(deactivated)).toBeNull();
  });

  /**
   * Separate from the deactivation test on purpose. A single `it` reports only
   * its FIRST failure, so holding both assertions would let a mutation that
   * broke soft-delete alone be masked by the deactivation assertion passing
   * above it. Two tests, two mutations.
   */
  it('excludes an agent whose account was soft-deleted', async () => {
    const deleted = await createFixture({ consented: true });

    await core.prisma.user.update({
      where: { id: deleted.userId },
      data: { deletedAt: new Date() },
    });

    expect(await entryFor(deleted)).toBeNull();
  });

  // ----- the certificate has to be THIS agent's ----- //

  /**
   * Finding 1 of the 22 September review, proved.
   *
   * `toPublicDirectoryEntry` takes the agent and the certificate as separate
   * arguments, and the link between `KamnetAgent.userId` and
   * `KbsCandidate.userId` crosses two databases with no foreign key to enforce
   * it. Before the ownership check, a mismatched pair was published without
   * complaint: this fixture pairs a consented agent with ANOTHER consented
   * agent's valid certificate, and every other condition is met, so the only
   * thing that can refuse it is the pairing itself.
   *
   * `toCertificateVerdict` has guarded the equivalent case since September with
   * `answer.kcaNumber !== requested`; this is the same rule, one surface over.
   */
  it("refuses an entry built from another agent's certificate", async () => {
    const agentA = await createFixture({ consented: true });
    const agentB = await createFixture({ consented: true });

    // Both are listable on their own - otherwise this would pass for the wrong
    // reason, refusing on a condition that has nothing to do with ownership.
    expect(await entryFor(agentA)).not.toBeNull();
    expect(await entryFor(agentB)).not.toBeNull();

    expect(await entryFor(agentA, agentB)).toBeNull();
  });
});
