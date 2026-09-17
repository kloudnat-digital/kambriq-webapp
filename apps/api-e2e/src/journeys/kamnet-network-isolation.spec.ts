import { API, call, login } from './support';

/**
 * One agent never sees another agent's network.
 *
 * ---------------------------------------------------------------------------
 * Why this is a journey and not a unit test
 * ---------------------------------------------------------------------------
 * The instruction was explicit: prove isolation with two agent accounts, not by
 * reading the guard. Reading `getMyNetwork` tells you it resolves the caller's
 * own record from `userId` and builds the tree from there. Running it with two
 * tokens tells you what the deployed API actually answers, which is the only
 * thing a claim about isolation can rest on. This repository has the lesson
 * written down twice: a guard whose failure has never been watched is a claim,
 * and every defect that mattered was invisible to inspection.
 *
 * ---------------------------------------------------------------------------
 * Why two seeded accounts rather than two minted ones
 * ---------------------------------------------------------------------------
 * `assertMinted` refuses any address this run did not generate, and it exists
 * because a journey once addressed a real administrator and its cleanup revoked
 * that person's role. It is not bypassed here and it is not weakened: this
 * suite performs **GET requests only**. It creates nothing, writes nothing and
 * cleans nothing up, so there is no write for provenance to protect.
 *
 * Minting two agents is also not currently possible end to end: a KAMNET agent
 * needs a KCA certificate, a certificate needs a passed exam, and `KbsExam` has
 * zero rows on dev - so the mint path cannot reach an agent record at all. The
 * seed builds the tree instead, and `journeys.spec.ts` already logs in as
 * `eric.mbou@kambriq.com` for the same reason.
 *
 * ---------------------------------------------------------------------------
 * Why this pair discriminates
 * ---------------------------------------------------------------------------
 * Two empty answers would prove nothing - they would be equal for the wrong
 * reason. The seeded tree is deliberately asymmetric:
 *
 *   Eric   (AGT-2025-0001, CONFIRMED, no sponsor)
 *     |- Sylvie (AGT-2025-0002, JUNIOR)
 *     |    `- Amina (AGT-2025-0004, JUNIOR)
 *     |- Boris  (AGT-2025-0003, JUNIOR)
 *     `- Paul   (AGT-2025-0005, JUNIOR)
 *
 * So Eric's N1 is three agents and Sylvie's is exactly one, and Sylvie appears
 * inside Eric's tree while Eric appears nowhere inside hers. A leak in either
 * direction changes a count.
 */

const ERIC = 'eric.mbou@kambriq.com';
const SYLVIE = 'sylvie.ngo@kambriq.com';

type Node = {
  agent: { id: string; agentCode: string; tier: string; user: { email: string } };
  referrals: Node[];
};

const flatten = (node: Node | null): Node[] =>
  node ? [node, ...node.referrals.flatMap((child) => flatten(child))] : [];

const codesIn = (node: Node | null): string[] =>
  flatten(node)
    .slice(1) // drop the root, which is the caller themselves
    .map((n) => n.agent.agentCode)
    .sort();

const network = async (token: string, depth: number): Promise<Node | null> => {
  const res = await call('GET', `/kamnet/network?depth=${depth}`, { token });
  if (res.status !== 200) {
    throw new Error(
      `GET /kamnet/network?depth=${depth} answered ${res.status}: ${res.body.slice(0, 200)}`,
    );
  }
  return res.json<{ data: Node | null }>().data;
};

jest.setTimeout(120_000);

let eric: string;
let sylvie: string;

beforeAll(async () => {
  // Report what is deployed rather than assume it. An unset EXPECTED_SHA must
  // not read as a passing gate, so the value is printed either way.
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

describe('two agents, two networks', () => {
  it('gives each agent a tree rooted on themselves', async () => {
    const [e, s] = await Promise.all([network(eric, 3), network(sylvie, 3)]);

    expect(e?.agent.agentCode).toBe('AGT-2025-0001');
    expect(s?.agent.agentCode).toBe('AGT-2025-0002');
    // The asymmetry that makes every assertion below meaningful.
    expect(e?.agent.agentCode).not.toBe(s?.agent.agentCode);
  });

  it("does not put Eric's referrals in Sylvie's network", async () => {
    const [e, s] = await Promise.all([network(eric, 3), network(sylvie, 3)]);

    const ericsCodes = codesIn(e);
    const sylviesCodes = codesIn(s);

    // Eric sponsors three directly, one of whom sponsors Amina: four below him.
    expect(ericsCodes).toEqual([
      'AGT-2025-0002',
      'AGT-2025-0003',
      'AGT-2025-0004',
      'AGT-2025-0005',
    ]);
    // Sylvie sponsors exactly one.
    expect(sylviesCodes).toEqual(['AGT-2025-0004']);

    // Boris and Paul are Eric's, and must appear in no answer of Sylvie's.
    expect(sylviesCodes).not.toContain('AGT-2025-0003');
    expect(sylviesCodes).not.toContain('AGT-2025-0005');
    // And Eric himself is above her, never inside her tree.
    expect(sylviesCodes).not.toContain('AGT-2025-0001');
  });

  it('leaks no email address across the two answers', async () => {
    // The stronger form of the same property: not "the codes differ" but "no
    // row belonging to one agent's subtree is reachable from the other's".
    const s = await network(sylvie, 3);
    const emails = flatten(s)
      .slice(1)
      .map((n) => n.agent.user.email);

    expect(emails).not.toContain(ERIC);
    expect(emails).toEqual(['amina.fall@kambriq.com']);
  });

  it('answers a depth of 3 for a JUNIOR, which is why the tier rule is not a boundary', async () => {
    /**
     * Sylvie is JUNIOR. UX specification 2.3 says a JUNIOR sees N1 only, and
     * the web applies that by asking for depth 1. The API does not: `getMyNetwork`
     * reads `depth` from the query and never looks at the caller's tier.
     *
     * This test asserts the CURRENT behaviour rather than the intended rule, so
     * that the gap is recorded rather than implied, and so that whoever closes
     * it on the server sees a test change and knows why. Isolation - whose rows
     * you can reach - is enforced. Depth - how far down your own tree you may
     * look - is not.
     */
    const s = await network(sylvie, 3);

    expect(s?.agent.tier).toBe('JUNIOR');
    expect(codesIn(s)).toEqual(['AGT-2025-0004']);
  });

  /**
   * The two refusals, which are two different mechanisms, asserted separately
   * rather than as "either of these codes".
   *
   * There is no seeded plain-client account - every seeded agent holds CLIENT,
   * KCA_CERTIFIED and AGENT together - so the first draft of this test called
   * `login('client@kambriq.com')`, caught the failure, logged "skipping" and
   * passed. A test that cannot fail is worse than no test: it reads as coverage
   * of a refusal nobody has ever observed.
   *
   * Two seeded accounts do hold no AGENT role, and they fail at different
   * layers:
   *
   *   ADMIN_KBS    lateral, implies nothing. Refused by @Roles(AGENT) -> 403.
   *   ADMIN_GLOBAL ROLE_HIERARCHY gives it AGENT, so it clears the guard and is
   *                then refused by findByUserId, which holds no agent record
   *                for it -> 404.
   */
  it('refuses the network with 403 to a role the hierarchy does not give AGENT', async () => {
    const adminKbs = await login('jean.kbs@kambriq.com');
    const res = await call('GET', '/kamnet/network?depth=1', { token: adminKbs });

    expect(res.status).toBe(403);
  });

  it('refuses the network with 404 to the super admin, who clears the guard and has no agent record', async () => {
    const superAdmin = await login('admin@kambriq.com');
    const res = await call('GET', '/kamnet/network?depth=1', { token: superAdmin });

    // Not 200 with an empty tree. "You are not an agent" and "you are an agent
    // with nobody under you" are different answers, and the screen tells them
    // apart by exactly this.
    expect(res.status).toBe(404);
  });
});
