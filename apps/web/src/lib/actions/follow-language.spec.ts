jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/api/server', () => ({
  api: {},
  serverApi: { get: jest.fn(), patch: jest.fn() },
}));
jest.mock('./revalidate', () => ({ revalidateLocalisedPath: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));

import { auth } from '@/auth';
import { serverApi } from '@/lib/api/server';
import { followLanguage } from './account';

const session = auth as unknown as jest.Mock;
const get = serverApi.get as jest.Mock;
const patch = serverApi.patch as jest.Mock;

/**
 * J4, second half - the language a signed-in person switches to is their
 * account's language, and so their emails'. A visitor with no account changes
 * nothing but the page. Tested here because the switcher's tests mock this
 * action.
 */
describe('J4 - switching language follows through to the account', () => {
  beforeEach(() => jest.resetAllMocks());

  it('a visitor: nothing is read or written', async () => {
    session.mockResolvedValue(null);
    expect(await followLanguage('en')).toEqual({ success: true, data: 'visitor' });
    expect(get).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('a session that can no longer be refreshed is a visitor, not a sign-in prompt', async () => {
    session.mockResolvedValue({ accessToken: 'stale', error: 'RefreshTokenError' });
    expect(await followLanguage('en')).toEqual({ success: true, data: 'visitor' });
    expect(patch).not.toHaveBeenCalled();
  });

  it('a signed-in person whose account differs: the account language is written', async () => {
    session.mockResolvedValue({ accessToken: 'token' });
    get.mockResolvedValue({ language: 'fr' });
    patch.mockResolvedValue({ language: 'en' });
    expect(await followLanguage('en')).toEqual({ success: true, data: 'saved' });
    expect(patch).toHaveBeenCalledWith('/users/me', { language: 'en' });
  });

  it('a signed-in person whose account already has it: nothing is written', async () => {
    session.mockResolvedValue({ accessToken: 'token' });
    get.mockResolvedValue({ language: 'en' });
    expect(await followLanguage('en')).toEqual({ success: true, data: 'unchanged' });
    expect(patch).not.toHaveBeenCalled();
  });

  it('a write that fails is reported as a failure, never as saved', async () => {
    session.mockResolvedValue({ accessToken: 'token' });
    get.mockResolvedValue({ language: 'fr' });
    patch.mockRejectedValue(new Error('down'));
    expect(await followLanguage('en')).toMatchObject({ success: false });
  });
});
