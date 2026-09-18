import { API, call, login } from './support';

/**
 * One agent never sees another agent's prospects.
 *
 * ---------------------------------------------------------------------------
 * Why a journey, and why seeded accounts
 * ---------------------------------------------------------------------------
 * The instruction was to prove isolation with two real agent accounts, not by
 * reading the guard - the same standard as `kamnet-network-isolation.spec.ts`.
 * Reading `findByIdAndOwner` tells you it compares `lead.agentId` to the
 * caller's agent id. Running it with two tokens tells you what the deployed API
 * answers, which is the only thing a claim about isolation can rest on.
 *
 * `assertMinted` is not bypassed and not weakened: this suite performs GET
 * requests only. It creates nothing, writes nothing, cleans nothing up, so
 * there is no write for provenance to protect. Minting two agents is also still
 * impossible end to end - an agent needs a KCA certificate, a certificate needs
 * a passed exam, and `KbsExam` has zero rows on dev.
 *
 * ---------------------------------------------------------------------------
 * Why this pair discriminates
 * ---------------------------------------------------------------------------
 * Counts alone would prove nothing here: the seed gives every agent exactly ONE
 * lead, so "Eric sees 1 and Sylvie sees 1" is equal for the wrong reason. What
 * separates them is identity, and the seed made them distinct on purpose:
 *
 *   Eric   AGT-2025-0001  Alphonse Bello  QUALIFIED  REFERRAL
 *   Sylvie AGT-2025-0002  Fatou Diallo    CONTACTED  SOCIAL_MEDIA
 *   Boris  AGT-2025-0003  Marc Eto'o      NEW        EVENT
 *   Amina  AGT-2025-0004  Rose Bekale     NEW        OTHER
 *   Paul   AGT-2025-0005  Samuel Owona    CONTACTED  SOCIAL_MEDIA
 *
 * So each assertion names a row. And the seeded lead ids are deterministic -
 * `00000000-0000-4000-8000-d00000001{01..05}` - which makes the cross-read
 * addressable without having to discover somebody else's id first.
 */

const ERIC = 'eric.mbou@kambriq.com';
const SYLVIE = 'sylvie.ngo@kambriq.com';

/** Seed ids, in seed order: Eric, Sylvie, Boris, Amina, Paul. */
const LEAD_ID = (n: number) => `00000000-0000-4000-8000-d0000000010${n}`;
const ERICS_LEAD = LEAD_ID(1);
const SYLVIES_LEAD = LEAD_ID(2);

type Lead = { id: string; clientName: string; status: string; agentId: string };

const myLeads = async (token: string): Promise<Lead[]> => {
  const res = await call('GET', '/kamnet/leads?limit=100', { token });
  if (res.status !== 200) {
    throw new Error(`GET /kamnet/leads answered ${res.status}: ${res.body.slice(0, 200)}`);
  }
  return res.json<{ data: Lead[] }>().data;
};

jest.setTimeout(120_000);

let eric: string;
let sylvie: string;

beforeAll(async () => {
  const version = await call('GET', '/health/version');
  if (version.status !== 200) {
    throw new Error(`${API}/health/version answered ${version.status}`);
  }
  const { data } = version.json<{ data: { gitSha: string; imageTag: string } }>();
  const expected = process.env['EXPECTED_SHA'];
  if (expected) {
    const short = expected.slice(0, 7);
    if (!data.gitSha.startsWith(short) && data.imageTag !== `sha-${short}`) {
      throw new Error(
        `sha gate: expected ${short}, deployed gitSha=${data.gitSha} imageTag=${data.imageTag}.`,
      );
    }
  } else {
    console.log(`sha gate NOT ENFORCED (EXPECTED_SHA unset). Deployed: ${data.imageTag}`);
  }

  eric = await login(ERIC);
  sylvie = await login(SYLVIE);
});

describe('two agents, two prospect lists', () => {
  it('gives each agent only their own prospects, named', async () => {
    const [e, s] = await Promise.all([myLeads(eric), myLeads(sylvie)]);

    const ericNames = e.map((l) => l.clientName).sort();
    const sylvieNames = s.map((l) => l.clientName).sort();

    expect(ericNames).toContain('Alphonse Bello');
    expect(sylvieNames).toContain('Fatou Diallo');

    // The asymmetry that makes this meaningful rather than a count comparison.
    expect(ericNames).not.toContain('Fatou Diallo');
    expect(sylvieNames).not.toContain('Alphonse Bello');
  });

  it('leaks no other agent of the network into either list', async () => {
    const [e, s] = await Promise.all([myLeads(eric), myLeads(sylvie)]);
    const others = ["Marc Eto'o", 'Rose Bekale', 'Samuel Owona'];

    for (const name of others) {
      expect(e.map((l) => l.clientName)).not.toContain(name);
      expect(s.map((l) => l.clientName)).not.toContain(name);
    }
  });

  it('scopes every row to the calling agent, checked on the rows themselves', async () => {
    // Not "the names differ" but "no row in this answer belongs to anybody
    // else" - asserted against the agentId the API returns on each row.
    const [e, s] = await Promise.all([myLeads(eric), myLeads(sylvie)]);

    const ericAgentIds = new Set(e.map((l) => l.agentId));
    const sylvieAgentIds = new Set(s.map((l) => l.agentId));

    expect(ericAgentIds.size).toBe(1);
    expect(sylvieAgentIds.size).toBe(1);
    expect([...ericAgentIds][0]).not.toBe([...sylvieAgentIds][0]);
  });

  /**
   * The second mechanism, asserted separately.
   *
   * The list is scoped by a `where` clause; a direct read is refused by
   * `findByIdAndOwner`, which throws `ForbiddenException`. Those are two
   * different guards and a single test covering both would not say which one
   * held.
   */
  it('refuses a direct read of another agent prospect with 403', async () => {
    const res = await call('GET', `/kamnet/leads/${ERICS_LEAD}`, { token: sylvie });

    expect(res.status).toBe(403);
  });

  it('refuses it in the other direction too', async () => {
    const res = await call('GET', `/kamnet/leads/${SYLVIES_LEAD}`, { token: eric });

    expect(res.status).toBe(403);
  });

  it('lets each agent read their own prospect by id', async () => {
    // The control. Without it, a 403 above could mean "the id is wrong" rather
    // than "the guard held", and the test would pass for the wrong reason.
    const mine = await call('GET', `/kamnet/leads/${ERICS_LEAD}`, { token: eric });
    const hers = await call('GET', `/kamnet/leads/${SYLVIES_LEAD}`, { token: sylvie });

    expect(mine.status).toBe(200);
    expect(hers.status).toBe(200);
    expect(mine.json<{ data: Lead }>().data.clientName).toBe('Alphonse Bello');
    expect(hers.json<{ data: Lead }>().data.clientName).toBe('Fatou Diallo');
  });

  it('refuses the prospect list to a caller with no agent record', async () => {
    // ADMIN_GLOBAL clears @Roles(AGENT) through ROLE_HIERARCHY, then
    // findByUserId has no record for it: 404, not 200 with an empty list.
    const superAdmin = await login('admin@kambriq.com');
    const res = await call('GET', '/kamnet/leads', { token: superAdmin });

    expect(res.status).toBe(404);
  });
});
