jest.mock('@/i18n/navigation', () => require('@/test-utils/navigation-mock'));
jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/lib/actions/newsletter', () => ({ subscribeNewsletterAction: jest.fn() }));

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { computeAccessibleName } from 'dom-accessibility-api';

import NewsletterSignup from './newsletter-signup';
import { subscribeNewsletterAction } from '@/lib/actions/newsletter';
import { setTestLocale } from '@/test-utils/next-intl-mock';
import { useToastStore } from '@/store/toast.store';
import en from '@/i18n/messages/en.json';
import fr from '@/i18n/messages/fr.json';

const subscribe = subscribeNewsletterAction as jest.MockedFunction<
  typeof subscribeNewsletterAction
>;

const toasts = () => useToastStore.getState().toasts;

/** The element an `aria-describedby` points at, so "tied to the field" is measured. */
const describedBy = (el: HTMLElement) => {
  const id = el.getAttribute('aria-describedby');
  return id ? document.getElementById(id) : null;
};

/**
 * P2 - the newsletter form, held to the contact form's discipline (L1).
 *
 * It had none of it: no consent, a single hard-coded English error on a French
 * site, and a server that checked nothing but the address. Every assertion here
 * reads the real catalogue, so what is asserted is what ships.
 */
describe('the newsletter form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setTestLocale('fr');
    useToastStore.setState({ toasts: [] });
    subscribe.mockResolvedValue({ success: true });
  });

  const emailInput = () => screen.getByRole('textbox');
  const consentBox = () => screen.getByRole('checkbox');
  const submitButton = () => screen.getByRole('button', { name: "S'abonner" });

  // ----- THE ACCESSIBLE NAMES ----- //

  it('the address field is named by a label, not by its placeholder', () => {
    render(<NewsletterSignup />);
    expect(computeAccessibleName(emailInput())).toBe('Adresse email');
  });

  it('the consent box is named by the whole sentence, links included', () => {
    render(<NewsletterSignup />);
    expect(computeAccessibleName(consentBox())).toBe(
      "J'accepte que mes données personnelles soient traitées conformément à la " +
        'politique de confidentialité et au RGPD',
    );
  });

  /**
   * P25 - the consent label is a flex container (the shared `Label`), and the
   * sentence was handed to it as five loose children: text, link, text, link.
   * Flex laid each out as its own column, so on dev the sentence read as four
   * side-by-side fragments with "politique de / confidentialité" squeezed into
   * 80 px. One inline element keeps it one sentence. The layout itself is proved
   * by screenshot; this pins the structure that decides it.
   */
  it('hands the consent sentence to its label as one element, links inside', () => {
    render(<NewsletterSignup />);
    const label = document.querySelector(`label[for="${consentBox().id}"]`);
    expect(label?.childNodes).toHaveLength(1);
    expect(label?.firstElementChild?.querySelectorAll('a')).toHaveLength(2);
  });

  it('links the consent to the privacy policy and to the RGPD page', () => {
    render(<NewsletterSignup />);
    expect(screen.getByRole('link', { name: 'politique de confidentialité' })).toHaveAttribute(
      'href',
      '/legal/privacy',
    );
    expect(screen.getByRole('link', { name: 'RGPD' })).toHaveAttribute('href', '/legal/rgpd');
  });

  it('asks the browser to fill the address', () => {
    render(<NewsletterSignup />);
    expect(emailInput()).toHaveAttribute('autocomplete', 'email');
  });

  // ----- ERRORS: VISIBLE, IN THE PAGE'S LANGUAGE, TIED TO THE FIELD ----- //

  it('shows the address error in French, tied to the field, and sends nothing', async () => {
    const user = userEvent.setup();
    render(<NewsletterSignup />);
    await user.click(consentBox());
    await user.click(submitButton());

    const message = await screen.findByText('Adresse email invalide');
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true');
    expect(describedBy(emailInput())).toBe(message);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('refuses to send without consent, and says why under the box', async () => {
    const user = userEvent.setup();
    render(<NewsletterSignup />);
    await user.type(emailInput(), 'reader@example.test');
    await user.click(submitButton());

    const message = await screen.findByText('Vous devez accepter le traitement de vos données');
    expect(consentBox()).toHaveAttribute('aria-invalid', 'true');
    expect(describedBy(consentBox())).toBe(message);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('renders the same errors in English on an English page', async () => {
    setTestLocale('en');
    const user = userEvent.setup();
    render(<NewsletterSignup />);
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));

    expect(await screen.findByText('Invalid email address')).toBeInTheDocument();
    expect(screen.getByText('You must accept data processing')).toBeInTheDocument();
  });

  // ----- WHAT IS SENT, AND WHAT IS SAID AFTERWARDS ----- //

  it('sends the address, the page language and the consent, then confirms', async () => {
    const user = userEvent.setup();
    render(<NewsletterSignup />);
    await user.type(emailInput(), 'reader@example.test');
    await user.click(consentBox());
    await user.click(submitButton());

    await waitFor(() =>
      expect(subscribe).toHaveBeenCalledWith({
        email: 'reader@example.test',
        locale: 'fr',
        consent: true,
      }),
    );
    expect(toasts().map((t) => t.title)).toContain('Inscription réussie !');
  });

  it('sends the language of an English page as en', async () => {
    setTestLocale('en');
    const user = userEvent.setup();
    render(<NewsletterSignup />);
    await user.type(emailInput(), 'reader@example.test');
    await user.click(consentBox());
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));

    await waitFor(() =>
      expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' })),
    );
  });

  it('names an already-subscribed address, keeps what was typed, and raises no success', async () => {
    subscribe.mockResolvedValue({
      success: false,
      error: 'This email is already subscribed.',
      status: 409,
      retryable: false,
    });
    const user = userEvent.setup();
    render(<NewsletterSignup />);
    await user.type(emailInput(), 'reader@example.test');
    await user.click(consentBox());
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cette adresse email est déjà inscrite à notre newsletter.',
    );
    expect(emailInput()).toHaveValue('reader@example.test');
    expect(toasts().some((t) => t.status === 'success')).toBe(false);
  });

  it('invites a retry, in French, when the server failed', async () => {
    subscribe.mockResolvedValue({ success: false, retryable: true });
    const user = userEvent.setup();
    render(<NewsletterSignup />);
    await user.type(emailInput(), 'reader@example.test');
    await user.click(consentBox());
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      fr.footer.newsletter.errors.submitFailed,
    );
  });

  // ----- THE CATALOGUES MOVE TOGETHER ----- //

  it('has the same newsletter keys in fr and en', () => {
    const keys = (o: object, prefix = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
      );
    expect(keys(en.footer.newsletter).sort()).toEqual(keys(fr.footer.newsletter).sort());
  });
});
