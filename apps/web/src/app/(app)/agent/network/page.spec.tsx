// `next-intl/server` ships ESM and Jest cannot parse it; the shared mock reads
// the REAL fr.json/en.json and throws on a missing key, so a page that would
// render `app.network.emptyTitle` to an agent fails here instead.
jest.mock('next-intl/server', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/lib/actions/kamnet', () => ({
  getMyAgentProfile: jest.fn(),
  getMyNetwork: jest.fn(),
  getMySponsors: jest.fn(),
}));

import { render, screen } from '@testing-library/react';

import { getMyAgentProfile, getMyNetwork, getMySponsors } from '@/lib/actions/kamnet';
import AgentNetworkPage from './page';

const profile = getMyAgentProfile as jest.MockedFunction<typeof getMyAgentProfile>;
const network = getMyNetwork as jest.MockedFunction<typeof getMyNetwork>;
const sponsors = getMySponsors as jest.MockedFunction<typeof getMySponsors>;

/**
 * `/agent/network`, which until now was the worst screen in the application.
 *
 * It was not a placeholder. It declared a module-level `const NETWORK` holding
 * six invented agents - Marie Kameni, Paul Eteme, Sophie Mbarga, Alain Fotso,
 * Claire Ngo, Jean Dupont - with invented sales and referral counts, and
 * rendered them. A screen saying "coming soon" is honest; this one looked
 * finished. An agent opening it saw a network that does not exist.
 *
 * So the load-bearing tests here are the NEGATIVE ones, exactly as on
 * `/verify-certificate`: whatever the API answers, those six names can never
 * appear. `Jean Dupont` was the hard-coded name on the certificate page too,
 * and it is the same defect wearing a different screen.
 *
 * The tier rule is the UX specification's, section 2.3, quoted verbatim:
 *   "Junior : filleuls N1 uniquement. Confirme : filleuls N1.
 *    Manager : filleuls N1+N2+N3 + stats reseau globales."
 * Note CONFIRMED sees N1 only, like JUNIOR. The brief names only Junior and
 * Manager and is silent on CONFIRMED, which is a real tier - so the
 * specification decides it and the PR says so.
 *
 * P9 (20 September 2026) SUPERSEDES the depth half of that quotation: every
 * tier asks for N1, because sponsorship now stops at the direct sponsor. The
 * quotation is left exactly as the specification writes it - editing a citation
 * to match a later decision misrepresents the document it cites. Only the
 * statistics half still separates a MANAGER from the rest.
 */

const INVENTED = [
  'Marie Kameni',
  'Paul Eteme',
  'Sophie Mbarga',
  'Alain Fotso',
  'Claire Ngo',
  'Jean Dupont',
];

const agentNode = (
  id: string,
  firstName: string,
  lastName: string,
  tier = 'JUNIOR',
  referrals: unknown[] = [],
) => ({
  agent: {
    id,
    agentCode: `AGT-2025-${id}`,
    tier,
    salesCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    user: { firstName, lastName, email: `${id}@example.test`, country: 'CM', city: 'Douala' },
  },
  referrals,
});

const answers = (tier: string, referrals: unknown[], chain: unknown[] = []) => {
  profile.mockResolvedValue({
    success: true,
    data: { id: 'me', agentCode: 'AGT-2025-0001', tier, salesCount: 6 },
  } as Awaited<ReturnType<typeof getMyAgentProfile>>);
  network.mockResolvedValue({
    success: true,
    data: agentNode('me', 'Eric', 'Mbou', tier, referrals),
  } as Awaited<ReturnType<typeof getMyNetwork>>);
  sponsors.mockResolvedValue({
    success: true,
    data: { agent: { id: 'me', agentCode: 'AGT-2025-0001' }, chain },
  } as Awaited<ReturnType<typeof getMySponsors>>);
};

const renderPage = async () => render(await AgentNetworkPage());

describe('/agent/network - the invented agents are gone', () => {
  beforeEach(() => jest.clearAllMocks());

  it('names none of the six invented agents, even when the network is empty', async () => {
    answers('JUNIOR', []);

    const { container } = await renderPage();

    for (const name of INVENTED) {
      expect(container).not.toHaveTextContent(name);
    }
  });

  it('names none of the six invented agents when the network is populated', async () => {
    answers('MANAGER', [agentNode('a2', 'Sylvie', 'Ngo')]);

    const { container } = await renderPage();

    for (const name of INVENTED) {
      expect(container).not.toHaveTextContent(name);
    }
    expect(screen.getByText('Sylvie Ngo')).toBeInTheDocument();
  });

  it('carries no hard-coded network source in the page module', async () => {
    // Structural, not behavioural: the constant could be re-added and the tests
    // above would still pass if the page merely stopped rendering it.
    //
    // Comments are stripped first, and this repository has now paid for that
    // lesson three times - `route-guards.spec.ts` counted a comment explaining a
    // route was NOT public, `brand-palette.spec.ts` flagged its own prose naming
    // the old hex values, and this test failed on the page's own docstring
    // listing the six agents it had just deleted. A sweep that bans a token
    // flags the code explaining the ban first.
    const raw = require('node:fs').readFileSync(__dirname + '/page.tsx', 'utf8') as string;
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(src).not.toMatch(/const\s+NETWORK\s*=/);
    expect(src).not.toMatch(/Marie Kameni|Jean Dupont|Sophie Mbarga/);
    // The stripper's discrimination is proved in
    // `no-colour-outside-the-system.spec.ts`, which feeds it a known-bad string
    // and a known-good one. It is NOT proved by asserting that this page's
    // prose still names the six agents: that would pin comment wording rather
    // than behaviour, and it failed the moment the docstring was reworded to
    // say "six agents who do not exist" instead of listing them.
  });
});

describe('/agent/network - the empty state is deliberate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('tells an agent with no referrals that they have none, rather than showing an empty grid', async () => {
    answers('JUNIOR', []);

    const { container } = await renderPage();

    expect(container.querySelector('[data-network="empty"]')).toBeInTheDocument();
    expect(container.querySelector('[data-network="tree"]')).not.toBeInTheDocument();
  });

  it('shows the tree, not the empty state, as soon as there is one referral', async () => {
    answers('JUNIOR', [agentNode('a2', 'Sylvie', 'Ngo')]);

    const { container } = await renderPage();

    expect(container.querySelector('[data-network="tree"]')).toBeInTheDocument();
    expect(container.querySelector('[data-network="empty"]')).not.toBeInTheDocument();
  });

  it('shows the empty state, not a crash, when the caller has no agent record at all', async () => {
    profile.mockResolvedValue({ success: true, data: null } as Awaited<
      ReturnType<typeof getMyAgentProfile>
    >);
    network.mockResolvedValue({ success: true, data: null } as Awaited<
      ReturnType<typeof getMyNetwork>
    >);
    sponsors.mockResolvedValue({ success: true, data: null } as Awaited<
      ReturnType<typeof getMySponsors>
    >);

    const { container } = await renderPage();

    expect(container.querySelector('[data-network="empty"]')).toBeInTheDocument();
  });

  it('shows the empty state when the action reports a failure, and never invents agents', async () => {
    profile.mockResolvedValue({ success: false, error: 'nope', status: 500 });
    network.mockResolvedValue({ success: false, error: 'nope', status: 500 });
    sponsors.mockResolvedValue({ success: false, error: 'nope', status: 500 });

    const { container } = await renderPage();

    expect(container.querySelector('[data-network="empty"]')).toBeInTheDocument();
    for (const name of INVENTED) {
      expect(container).not.toHaveTextContent(name);
    }
  });
});

describe('/agent/network - depth and statistics follow the tier', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks for N1 only when the agent is JUNIOR', async () => {
    answers('JUNIOR', []);

    await renderPage();

    expect(network).toHaveBeenCalledWith(1);
  });

  it('asks for N1 only when the agent is CONFIRMED, per UX 2.3', async () => {
    // The specification puts CONFIRMED at N1, the same as JUNIOR. This is the
    // assertion that fails if somebody "simplifies" the rule to Junior vs rest.
    answers('CONFIRMED', []);

    await renderPage();

    expect(network).toHaveBeenCalledWith(1);
  });

  it('asks for N1 even when the agent is MANAGER, since P9', async () => {
    /**
     * INVERTED by P9, not deleted. It read "asks for N1 to N3 when the agent is
     * MANAGER" and expected 3 - accurate about the code and, after the 20
     * September arbitrage, wrong about the requirement.
     *
     * It is also the test that did NOT fail when the constant moved, because
     * `DEPTH_FOR_TIER` held a hardcoded 3 that never read it. The page asked for
     * a depth the action silently clamped, and this assertion agreed with the
     * page rather than with the platform. That is why the literal 1 is asserted
     * here too: a depth change must turn this red.
     */
    answers('MANAGER', []);

    await renderPage();

    expect(network).toHaveBeenCalledWith(1);
  });

  it('shows network statistics to a MANAGER', async () => {
    answers('MANAGER', [
      agentNode('a2', 'Sylvie', 'Ngo', 'JUNIOR', [agentNode('a4', 'Amina', 'Fall')]),
      agentNode('a3', 'Boris', 'Tcha'),
    ]);

    const { container } = await renderPage();

    const stats = container.querySelector('[data-network-stats]');
    expect(stats).toBeInTheDocument();
    // Three agents across two levels: two at N1, one at N2. This fixture is
    // handed to the component directly, so it still exercises nested rendering
    // - but since P9 the API no longer returns a second level, so no live
    // response has this shape. Kept deliberately: the component's ability to
    // render depth outlives the business rule that currently forbids it.
    expect(stats).toHaveTextContent('3');
  });

  it('shows no network statistics to a JUNIOR or a CONFIRMED', async () => {
    for (const tier of ['JUNIOR', 'CONFIRMED']) {
      jest.clearAllMocks();
      answers(tier, [agentNode('a2', 'Sylvie', 'Ngo')]);

      const { container } = await renderPage();

      expect(container.querySelector('[data-network-stats]')).not.toBeInTheDocument();
    }
  });

  it('labels each referral with the level it sits at', async () => {
    answers('MANAGER', [
      agentNode('a2', 'Sylvie', 'Ngo', 'JUNIOR', [agentNode('a4', 'Amina', 'Fall')]),
    ]);

    const { container } = await renderPage();

    const nodes = container.querySelectorAll('[data-level]');
    expect(nodes.length).toBe(2);
    expect(Array.from(nodes).map((n) => n.getAttribute('data-level'))).toEqual(['1', '2']);
  });
});
