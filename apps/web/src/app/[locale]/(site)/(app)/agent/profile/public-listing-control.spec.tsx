jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/lib/actions/kamnet', () => ({ setMyPublicListing: jest.fn() }));

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { computeAccessibleName } from 'dom-accessibility-api';

import { setMyPublicListing } from '@/lib/actions/kamnet';
import { setTestLocale } from '@/test-utils/next-intl-mock';
import { useToastStore } from '@/store/toast.store';
import { PublicListingControl } from './public-listing-control';

const save = setMyPublicListing as jest.MockedFunction<typeof setMyPublicListing>;

/** Every toast raised during a test, so "no success toast" is checkable. */
const toasts = () => useToastStore.getState().toasts;

const box = () => screen.getByRole('checkbox');

/**
 * P11 - the agent's switch into the public directory.
 *
 * ---------------------------------------------------------------------------
 * The assertions people will care about are the negative ones
 * ---------------------------------------------------------------------------
 * What is being reported here is whether a real person's name, city and
 * certificate number are on an anonymous page. So the tests that matter are:
 * the box never moves on a failed write, and no success toast appears unless
 * the server said yes. `contact-form.spec.tsx` exists for the same reason - its
 * predecessor raised a success toast after `setTimeout(800)` and sent nothing.
 *
 * ---------------------------------------------------------------------------
 * Two of these assert COPY, on purpose
 * ---------------------------------------------------------------------------
 * Consent to publish somebody's identity is only consent if they were told what
 * is published and that they can take it back. Those two sentences are part of
 * the control's contract, not decoration, so they are pinned: an edit that
 * quietly drops "what is published" or "withdrawal is immediate" fails here
 * rather than shipping a checkbox that asks for permission without saying for
 * what.
 */
describe('the public listing control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setTestLocale('fr');
    useToastStore.setState({ toasts: [] });
  });

  const renderControl = (listedSince: string | null = null, suspended = false) =>
    render(<PublicListingControl listedSince={listedSince} suspended={suspended} />);

  // ----- the state it starts in ----- //

  it('is unchecked for an agent who has not consented', () => {
    renderControl(null);

    expect(box()).not.toBeChecked();
    expect(
      screen.getByText(/Vous ne figurez pas dans l’annuaire|Vous ne figurez pas dans l'annuaire/),
    ).toBeInTheDocument();
  });

  it('is checked, with the date, for an agent who has', () => {
    renderControl('2026-09-22T08:00:00.000Z');

    expect(box()).toBeChecked();
    expect(screen.getByText(/Vous figurez dans l/)).toBeInTheDocument();
  });

  // ----- the contract the copy makes ----- //

  it('states exactly what is published, field by field', () => {
    renderControl(null);

    const published = screen.getByText(/Ce qui est publié/);

    for (const field of ['prénom', 'nom', 'ville', 'pays', 'photo', 'numéro KCA', 'délivrance']) {
      expect(published).toHaveTextContent(field);
    }
    // And what is not, which is the half an agent would not think to ask about.
    for (const field of ['ventes', 'filleuls', 'parrain', 'niveau']) {
      expect(published).toHaveTextContent(field);
    }
  });

  it('states that consent can be withdrawn at any time, with immediate effect', () => {
    renderControl('2026-09-22T08:00:00.000Z');

    const withdraw = screen.getByText(/retirer votre accord/);

    expect(withdraw).toHaveTextContent(/à tout moment/);
    expect(withdraw).toHaveTextContent(/immédiatement/);
  });

  it('names the checkbox, which a button with a label does not always do', () => {
    renderControl(null);

    expect(computeAccessibleName(box())).toBe("Apparaître dans l'annuaire des agents certifiés");
  });

  // ----- the negative case, which is the one that matters ----- //

  it('leaves the box alone and raises no success toast when the server refuses', async () => {
    save.mockResolvedValue({ success: false, error: 'nope', status: 403 });
    const user = userEvent.setup();
    renderControl(null);

    await user.click(box());

    await waitFor(() => expect(save).toHaveBeenCalledWith(true));
    expect(box()).not.toBeChecked();
    expect(toasts().map((t) => t.status)).toEqual(['error']);
    expect(toasts().some((t) => t.status === 'success')).toBe(false);
  });

  it('moves only once the server has confirmed', async () => {
    save.mockResolvedValue({
      success: true,
      data: { publicListingConsentAt: '2026-09-22T09:00:00.000Z' },
    });
    const user = userEvent.setup();
    renderControl(null);

    await user.click(box());

    await waitFor(() => expect(box()).toBeChecked());
    expect(toasts().map((t) => t.status)).toEqual(['success']);
  });

  it('withdraws, and says the entry was removed', async () => {
    save.mockResolvedValue({ success: true, data: { publicListingConsentAt: null } });
    const user = userEvent.setup();
    renderControl('2026-09-22T08:00:00.000Z');

    await user.click(box());

    await waitFor(() => expect(box()).not.toBeChecked());
    expect(save).toHaveBeenCalledWith(false);
    expect(toasts()[0]?.status).toBe('success');
  });

  /** A suspended agent cannot be listed - the API refuses it, and so does this. */
  it('is disabled for a suspended agent', () => {
    renderControl(null, true);

    expect(box()).toBeDisabled();
  });
});
