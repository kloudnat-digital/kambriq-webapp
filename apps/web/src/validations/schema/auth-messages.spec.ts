import fr from '@/i18n/messages/fr.json';
import en from '@/i18n/messages/en.json';
import {
  ForgotPasswordResolver,
  LoginResolver,
  ReactivateResolver,
  RegisterResolver,
  ResetPasswordResolver,
} from './auth';

/**
 * J12 - the sign-in and account forms speak the reader's language. Their
 * schemas carry translation KEYS, never sentences, and each key exists in both
 * catalogues under `auth.validation`. The French sign-in page answered an empty
 * submission with "Please enter a valid email address".
 */
const messagesOf = (result: {
  success: boolean;
  error?: { issues: Array<{ message: string }> };
}) => (result.success ? [] : (result.error?.issues ?? []).map((i) => i.message));

const EVERY_REFUSAL = [
  ...messagesOf(LoginResolver.safeParse({ email: 'x', password: '', rememberMe: false })),
  ...messagesOf(
    RegisterResolver.safeParse({
      firstName: 'a',
      lastName: 'b',
      email: 'x',
      password: 'a',
      phone: 'x',
    }),
  ),
  ...messagesOf(
    RegisterResolver.safeParse({
      firstName: 'Ab',
      lastName: 'Cd',
      email: 'a@b.cm',
      password: 'abcdefgh',
      phone: '+237695123456',
    }),
  ),
  ...messagesOf(
    RegisterResolver.safeParse({
      firstName: 'Ab',
      lastName: 'Cd',
      email: 'a@b.cm',
      password: 'Abcdefgh',
      phone: '+237695123456',
    }),
  ),
  ...messagesOf(
    RegisterResolver.safeParse({
      firstName: 'Ab',
      lastName: 'Cd',
      email: 'a@b.cm',
      password: 'Abcdefg1',
      phone: '+237695123456',
    }),
  ),
  ...messagesOf(ForgotPasswordResolver.safeParse({ email: 'x' })),
  ...messagesOf(ResetPasswordResolver.safeParse({ password: 'Abcdefg1!', confirmPassword: '' })),
  ...messagesOf(
    ResetPasswordResolver.safeParse({ password: 'Abcdefg1!', confirmPassword: 'Other1!x' }),
  ),
  ...messagesOf(ReactivateResolver.safeParse({ email: 'x', password: '' })),
];

describe('J12 - the auth forms refuse in the reader language', () => {
  it('produces the refusals it is meant to', () => {
    expect(new Set(EVERY_REFUSAL).size).toBeGreaterThanOrEqual(10);
  });

  it.each([
    ['fr', fr],
    ['en', en],
  ] as const)('every refusal is a key the %s catalogue translates', (_locale, messages) => {
    const validation = (messages.auth as Record<string, unknown>).validation as
      | Record<string, string>
      | undefined;
    const missing = [...new Set(EVERY_REFUSAL)].filter(
      (key) => typeof validation?.[key] !== 'string',
    );
    expect(missing).toEqual([]);
  });
});
