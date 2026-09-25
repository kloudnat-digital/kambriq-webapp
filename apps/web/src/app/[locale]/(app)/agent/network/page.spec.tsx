jest.mock('@/i18n/navigation', () => require('@/test-utils/navigation-mock'));
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
 * Asserts the negative constraint: `/agent/network` must never render hardcoded agents.
 *
 * Earlier implementations displayed static placeholders if the API was empty.
 * This test ensures that the real API response entirely dictates the page structure.
 * Additionally verifies depth rules according to UX spec section 2.3 and P9:
 * - All tiers (JUNIOR, CONFIRMED, MANAGER) request N1 depth.
 * - Only MANAGER renders network statistics.
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
    // Evaluates structure statically. Ensures no hardcoded fallback is reintroduced silently.
    // Strips comments first so this test does not fail on its own documentation.
    const raw = require('node:fs').readFileSync(__dirname + '/page.tsx', 'utf8') as string;
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(src).not.toMatch(/const\s+NETWORK\s*=/);
    expect(src).not.toMatch(/Marie Kameni|Jean Dupont|Sophie Mbarga/);
    // The regex's accuracy is verified in `no-colour-outside-the-system.spec.ts`.
    // We intentionally avoid asserting comment text here to prevent brittle tests.
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
    // Per UX spec 2.3, CONFIRMED is restricted to N1 depth.
    answers('CONFIRMED', []);

    await renderPage();

    expect(network).toHaveBeenCalledWith(1);
  });

  it('asks for N1 even when the agent is MANAGER, since P9', async () => {
    /**
     * P9 overrides earlier spec: depth is always clamped at N1.
     * Asserts literal `1` to catch regressions if depth logic diverges.
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
    // Exercises nested rendering for statistics with a multi-level fixture.
    // The API restricts depth to N1, but the component supports rendering N-level depth.
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
