jest.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }));
jest.mock('@/lib/api/server', () => ({ api: {} }));
jest.mock('@/auth', () => ({ signIn: jest.fn(), signOut: jest.fn() }));
jest.mock('@/i18n/navigation', () => ({ redirect: jest.fn() }));
jest.mock('@/lib/locale', () => ({ currentLocale: jest.fn().mockResolvedValue('fr') }));

import { signIn } from '@/auth';
import { logInAction } from './auth';

const credentials = { email: 'a@b.cm', password: 'x', rememberMe: false };
const redirectTo = () =>
  (jest.mocked(signIn).mock.calls[0][1] as { redirectTo: string }).redirectTo;

/**
 * I45 - the login goes back where the person was sent from.
 *
 * `logInAction` signed in with `redirectTo: '/'`, a literal: every `callbackUrl`
 * the proxy wrote was read by nobody (P3 said so). The email-change link is
 * behind the login page, so a signed-out person clicking it came back to their
 * home page instead of the confirmation. Read now - through `safeCallbackUrl`,
 * which P3 wrote for exactly this, so it cannot become an open redirect.
 */
describe('I45 - logInAction honours callbackUrl, and only an internal one', () => {
  beforeEach(() => jest.mocked(signIn).mockReset());

  it('goes back to the page that sent the person to log in, query included', async () => {
    await logInAction({
      ...credentials,
      callbackUrl: '/fr/account/confirm-email-change?token=abc',
    });
    expect(redirectTo()).toBe('/fr/account/confirm-email-change?token=abc');
  });

  it.each([
    'https://evil.example/phish',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
  ])('refuses %s and goes home', async (callbackUrl) => {
    await logInAction({ ...credentials, callbackUrl });
    expect(redirectTo()).toBe('/');
  });

  it('goes home when nobody sent the person anywhere', async () => {
    await logInAction(credentials);
    expect(redirectTo()).toBe('/');
  });
});
