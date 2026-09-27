jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
jest.mock('@/i18n/navigation', () => require('@/test-utils/navigation-mock'));
jest.mock('@/lib/actions/auth', () => ({ logInAction: jest.fn() }));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setTestLocale } from '@/test-utils/next-intl-mock';
import Login from './page';

/**
 * J12 - the sign-in page is the first page somebody signs in on and the one
 * where a refusal is most likely. It answered an empty French submission in
 * English. Each locale now reads its own refusals.
 */
describe('J12 - the sign-in refusals speak the reader language', () => {
  afterAll(() => setTestLocale('fr'));

  it.each([
    ['fr', 'Saisissez une adresse email valide.', 'Le mot de passe est requis.'],
    ['en', 'Please enter a valid email address.', 'Password is required.'],
  ] as const)('%s', async (locale, emailRefusal, passwordRefusal) => {
    setTestLocale(locale);
    render(<Login />);
    await userEvent.click(screen.getByRole('button', { name: /connecter|log ?in|sign ?in/i }));
    expect(await screen.findByText(emailRefusal)).toBeInTheDocument();
    expect(screen.getByText(passwordRefusal)).toBeInTheDocument();
  });
});
