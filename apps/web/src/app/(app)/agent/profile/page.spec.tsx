jest.mock('next-intl/server', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/lib/actions/kamnet', () => ({ getMyAgentProfile: jest.fn() }));
jest.mock('./public-listing-control', () => ({
  // A probe rather than the real control: this file is about what the page
  // decides and hands down, and the control has its own tests next door.
  PublicListingControl: (props: { listedSince: string | null; suspended: boolean }) => (
    <div
      data-control="listing"
      data-listed-since={props.listedSince ?? ''}
      data-suspended={String(props.suspended)}
    />
  ),
}));

import { render } from '@testing-library/react';

import { getMyAgentProfile } from '@/lib/actions/kamnet';
import AgentProfilePage from './page';

const profile = getMyAgentProfile as jest.MockedFunction<typeof getMyAgentProfile>;

const answers = (data: unknown) =>
  profile.mockResolvedValue({ success: true, data } as Awaited<
    ReturnType<typeof getMyAgentProfile>
  >);

const renderPage = async () => render(await AgentProfilePage());

/**
 * P11 - `/agent/profile`, the screen that exists so the consent control has
 * somewhere honest to live.
 *
 * The subject asked for the control "on their profile screen" and there was no
 * profile screen: `(app)/profile` and `(app)/agent/dashboard` are both
 * `PlaceholderPage`, an "under construction" card listing features that do not
 * exist. Visquis chose a minimal real screen on 22 September.
 *
 * What is worth testing here is the fork, not the layout: a user with no agent
 * record must be told so rather than shown a control that would 404 on use, and
 * a failed read must land in the same place rather than fill the gap with
 * something invented - the rule `network-empty.tsx` records.
 */
describe('/agent/profile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the consent control to an agent, carrying their current consent', async () => {
    answers({
      id: 'a1',
      publicListingConsentAt: '2026-09-22T08:00:00.000Z',
      suspendedAt: null,
    });

    const { container } = await renderPage();
    const control = container.querySelector('[data-control="listing"]');

    expect(control).toBeInTheDocument();
    expect(control).toHaveAttribute('data-listed-since', '2026-09-22T08:00:00.000Z');
    expect(control).toHaveAttribute('data-suspended', 'false');
    expect(container.querySelector('[data-agent-profile="empty"]')).not.toBeInTheDocument();
  });

  it('passes suspension down, because a suspended agent may not be listed', async () => {
    answers({ id: 'a1', publicListingConsentAt: null, suspendedAt: '2026-09-01T00:00:00.000Z' });

    const { container } = await renderPage();

    expect(container.querySelector('[data-control="listing"]')).toHaveAttribute(
      'data-suspended',
      'true',
    );
  });

  it('tells a user who is not an agent, rather than showing a control', async () => {
    answers(null);

    const { container } = await renderPage();

    expect(container.querySelector('[data-agent-profile="empty"]')).toBeInTheDocument();
    expect(container.querySelector('[data-control="listing"]')).not.toBeInTheDocument();
  });

  it('lands in the same empty state when the read itself failed', async () => {
    profile.mockResolvedValue({ success: false, error: 'boom', status: 500 });

    const { container } = await renderPage();

    expect(container.querySelector('[data-agent-profile="empty"]')).toBeInTheDocument();
    expect(container.querySelector('[data-control="listing"]')).not.toBeInTheDocument();
  });
});
