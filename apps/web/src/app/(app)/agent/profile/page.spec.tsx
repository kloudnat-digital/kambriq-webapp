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
 * What is worth testing here is the fork, not the layout, and the fork has
 * THREE branches rather than two.
 *
 * A user with no agent record must be told so rather than shown a control that
 * would 404 on use. But a failed read is a different thing entirely, and the
 * first version of this page treated the two as one: both rendered "Vous
 * n'etes pas agent KAMNET", so a real agent was told they were not an agent
 * whenever the API was down. Visquis caught it on 22 September.
 *
 * The test below that asserted that behaviour is INVERTED rather than deleted -
 * it was accurate about the code and wrong about the requirement, which is the
 * same shape as `seed-ids.spec.ts` defending the seed defect. What it pins now
 * is the opposite, plus the assertion that matters most: a non-404 failure must
 * never show the "not an agent" words at all.
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

  // ----- a failed read is not "you are not an agent" ----- //

  /**
   * Inverted on 22 September. This test previously asserted that a failure
   * rendered the empty state, which was true of the code and wrong about the
   * requirement.
   */
  it('says it cannot read the profile when the action reports a failure', async () => {
    profile.mockResolvedValue({ success: false, error: 'boom', status: 500 });

    const { container } = await renderPage();

    expect(container.querySelector('[data-agent-profile="unavailable"]')).toBeInTheDocument();
    expect(container.querySelector('[data-agent-profile="empty"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-control="listing"]')).not.toBeInTheDocument();
  });

  /**
   * The shape the real action actually produces. `nullOn404` rethrows anything
   * that is not a 404 and `createAction` rethrows anything that is not a
   * `ServerActionError`, so a 500 or an unreachable API arrives as a REJECTED
   * promise. A page that only handled `success: false` would crash here.
   */
  it('says it cannot read the profile when the action throws', async () => {
    profile.mockRejectedValue(new Error('fetch failed'));

    const { container } = await renderPage();

    expect(container.querySelector('[data-agent-profile="unavailable"]')).toBeInTheDocument();
    expect(container.querySelector('[data-control="listing"]')).not.toBeInTheDocument();
  });

  /**
   * The assertion this whole change exists for.
   *
   * A real agent reading this screen during an outage must not be told they are
   * not an agent. Asserted on the WORDS rather than on a `data-` attribute,
   * because the defect was the sentence: the two branches could be renamed and
   * still say the same wrong thing to the person reading it.
   */
  it.each([
    [
      'a failure envelope',
      () => profile.mockResolvedValue({ success: false, error: 'x', status: 500 }),
    ],
    ['a rejection', () => profile.mockRejectedValue(new Error('fetch failed'))],
  ])('never tells an agent they are not one - %s', async (_case, arrange) => {
    arrange();

    const { container } = await renderPage();

    expect(container).not.toHaveTextContent(/pas agent KAMNET/);
    expect(container).toHaveTextContent(/momentanément indisponible/);
    expect(container).toHaveTextContent(/Rien n'a changé/);
  });
});
