jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/lib/actions/contact', () => ({ submitContactRequestAction: jest.fn() }));

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { computeAccessibleName } from 'dom-accessibility-api';

import { ContactForm } from './contact-form';
import { submitContactRequestAction } from '@/lib/actions/contact';
import { setTestLocale } from '@/test-utils/next-intl-mock';
import { useToastStore } from '@/store/toast.store';

const submit = submitContactRequestAction as jest.MockedFunction<typeof submitContactRequestAction>;

/** Every toast raised during a test, so "no success toast" is checkable. */
const toasts = () => useToastStore.getState().toasts;

const MESSAGE =
  'Bonjour, je cherche une parcelle titree dans le Littoral pour un projet familial. ' +
  'Nous avons un budget arrete et nous souhaitons acheter avant la fin de l annee. ' +
  'Pouvez-vous me dire ce qui est disponible et sous quelles conditions ?';

/**
 * L1 + L2 - the contact form.
 *
 * What it replaced showed a success toast after `setTimeout(800)` and sent
 * nothing. So the assertions people will care about most are the negative ones:
 * no toast unless the server said yes, and nothing typed is ever lost.
 */
describe('the contact form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setTestLocale('fr');
    useToastStore.setState({ toasts: [] });
    submit.mockResolvedValue({ success: true, reference: 'KBQ-C-ABCD1234' });
  });

  /** Fills every field except the subject, which each test decides. */
  const fillEverythingElse = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText(/Nom complet/), 'Amina Nkolo');
    await user.type(screen.getByLabelText(/^Email/), 'prospect@example.test');
    await user.type(screen.getByLabelText(/^Message/), MESSAGE);
    await user.click(screen.getByRole('checkbox'));
  };

  const chooseSubject = async (user: ReturnType<typeof userEvent.setup>, label: RegExp) => {
    await user.click(screen.getByTestId('contact-subject-trigger'));
    await user.click(await screen.findByRole('option', { name: label }));
  };

  // ----- THE ACCESSIBLE NAME ----- //

  it('the subject trigger has an accessible name', () => {
    /**
     * Measured in the accessibility tree, not in the DOM.
     *
     * Before this chantier the label was a `<label>` with no `for` and the
     * trigger a `<button role="combobox">` with neither `aria-label` nor
     * `aria-labelledby`, so `computeAccessibleName` returned `""` - the control
     * announced itself as an unnamed combo box. A `for` would not have fixed
     * it either: a `<label>` does not name a button.
     */
    render(<ContactForm />);
    const trigger = screen.getByTestId('contact-subject-trigger');

    expect(computeAccessibleName(trigger)).toBe('Sujet *');
    expect(computeAccessibleName(trigger)).not.toBe('');
  });

  // ----- THE SUBJECT, VISIBLY VALIDATED ----- //

  it('a submission with no subject shows a visible error and does not submit', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillEverythingElse(user);
    await user.click(screen.getByRole('button', { name: /Envoyer le message/ }));

    // Visible, in the page's language, under the field.
    const error = await screen.findByText('Choisissez le sujet de votre demande.');
    expect(error).toBeVisible();

    // And nothing was sent.
    expect(submit).not.toHaveBeenCalled();
    expect(toasts()).toHaveLength(0);
  });

  it('the error is tied to the trigger, which is marked invalid and given focus', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillEverythingElse(user);
    await user.click(screen.getByRole('button', { name: /Envoyer le message/ }));

    const trigger = await screen.findByTestId('contact-subject-trigger');
    await waitFor(() => expect(trigger).toHaveAttribute('aria-invalid', 'true'));

    // The message a screen reader reads out when the trigger takes focus.
    const describedBy = trigger.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      'Choisissez le sujet de votre demande.',
    );

    // Focus moved to something a person can act on. The old form left it on a
    // 1x1 aria-hidden native select the browser refused to focus at all.
    expect(trigger).toHaveFocus();
  });

  it('the hidden native select no longer carries `required`', () => {
    /**
     * The mechanism behind the audit's finding. `<Select required>` makes Radix
     * render a native `<select required>` at 1x1 pixels, `aria-hidden`,
     * `tabIndex={-1}`. Constraint validation then blocked submission on a
     * control the browser could neither focus nor annotate: no message, no
     * highlight, and the submit handler never ran.
     */
    const { container } = render(<ContactForm />);
    const native = container.querySelector('select');
    if (native) expect(native.hasAttribute('required')).toBe(false);

    // And the form opts out of native validation, so the rule is the
    // resolver's and there is exactly one of it.
    expect(container.querySelector('form')).toHaveAttribute('noValidate');
  });

  // ----- CONSENT, AUTOCOMPLETE, PLACEHOLDER ----- //

  it('requires consent, and links the privacy policy', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.type(screen.getByLabelText(/Nom complet/), 'Amina Nkolo');
    await user.type(screen.getByLabelText(/^Email/), 'prospect@example.test');
    await user.type(screen.getByLabelText(/^Message/), MESSAGE);
    await chooseSubject(user, /Terrains/);
    // consent deliberately left unticked
    await user.click(screen.getByRole('button', { name: /Envoyer le message/ }));

    expect(
      await screen.findByText(
        'Votre accord est nécessaire avant que nous puissions conserver vos coordonnées.',
      ),
    ).toBeVisible();
    expect(submit).not.toHaveBeenCalled();

    const link = screen.getByRole('link', { name: 'politique de confidentialité' });
    expect(link).toHaveAttribute('href', '/legal/privacy');
  });

  it('carries autocomplete on the identity fields and an international phone placeholder', () => {
    render(<ContactForm />);

    expect(screen.getByLabelText(/Nom complet/)).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText(/Téléphone/)).toHaveAttribute('autocomplete', 'tel');

    // Not `+237 6 XX XX XX XX`. The client base this form exists to hear from
    // is the diaspora, and a Cameroonian placeholder reads as a requirement.
    const phone = screen.getByLabelText(/Téléphone/);
    expect(phone).toHaveAttribute('placeholder', '+33 6 12 34 56 78');
    expect(phone.getAttribute('placeholder')).not.toContain('+237');
  });

  // ----- SUCCESS ----- //

  it('sends what was typed, and shows the toast only after the server confirmed', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await fillEverythingElse(user);
    await chooseSubject(user, /Terrains/);

    // Nothing yet: the toast is not on a timer.
    expect(toasts()).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /Envoyer le message/ }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Amina Nkolo',
        email: 'prospect@example.test',
        subject: 'LANDS',
        message: MESSAGE,
        locale: 'fr',
        consent: true,
      }),
    );

    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0].status).toBe('success');

    // The reference is shown, so the prospect can quote it back.
    expect(await screen.findByText(/KBQ-C-ABCD1234/)).toBeVisible();
  });

  it('sends the locale of the page, so the acknowledgement is in it', async () => {
    setTestLocale('en');
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.type(screen.getByLabelText(/Full name/), 'Amina Nkolo');
    await user.type(screen.getByLabelText(/^Email/), 'prospect@example.test');
    await user.type(screen.getByLabelText(/^Message/), MESSAGE);
    await user.click(screen.getByRole('checkbox'));
    await chooseSubject(user, /Land/);
    await user.click(screen.getByRole('button', { name: /Send message/ }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0].locale).toBe('en');
  });

  // ----- FAILURE ----- //

  describe('when the server action fails', () => {
    it('shows no success toast and keeps every value the prospect typed', async () => {
      submit.mockResolvedValue({ success: false, retryable: true });
      const user = userEvent.setup();
      render(<ContactForm />);

      await fillEverythingElse(user);
      await chooseSubject(user, /Terrains/);
      await user.click(screen.getByRole('button', { name: /Envoyer le message/ }));

      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));

      // The whole point: no toast on a failure. The old form showed one
      // unconditionally, on a timer, having sent nothing.
      expect(toasts()).toHaveLength(0);

      // And three paragraphs are not lost.
      expect(screen.getByLabelText(/^Message/)).toHaveValue(MESSAGE);
      expect(screen.getByLabelText(/Nom complet/)).toHaveValue('Amina Nkolo');
      expect(screen.getByLabelText(/^Email/)).toHaveValue('prospect@example.test');
      expect(screen.getByRole('checkbox')).toHaveAttribute('data-state', 'checked');
    });

    it('announces the failure in a role="alert" region', async () => {
      submit.mockResolvedValue({ success: false, retryable: true });
      const user = userEvent.setup();
      render(<ContactForm />);

      await fillEverythingElse(user);
      await chooseSubject(user, /Terrains/);
      await user.click(screen.getByRole('button', { name: /Envoyer le message/ }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent("Le message n'a pas été envoyé.");
      expect(alert).toHaveTextContent(/réessayez dans un instant/);
    });

    it('a refusal says what was refused, and does not invite a pointless retry', async () => {
      submit.mockResolvedValue({
        success: false,
        error: 'Too many requests',
        retryable: false,
      });
      const user = userEvent.setup();
      render(<ContactForm />);

      await fillEverythingElse(user);
      await chooseSubject(user, /Terrains/);
      await user.click(screen.getByRole('button', { name: /Envoyer le message/ }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Too many requests');
      expect(alert).not.toHaveTextContent(/réessayez dans un instant/);
      expect(toasts()).toHaveLength(0);
    });

    it('the alert region exists before there is anything to announce', () => {
      // A live region inserted at the moment it gets content is announced
      // unreliably; one that is already there and then fills is announced.
      render(<ContactForm />);
      expect(screen.getByTestId('contact-form-error')).toHaveAttribute('role', 'alert');
    });
  });
});
