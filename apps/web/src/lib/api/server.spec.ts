/**
 * The authenticated API client, and what it does when the API refuses a token.
 *
 * `authedFetch` redirected to login only when the session already carried
 * `RefreshTokenError`, which `jwt()` sets only when it attempts a refresh - and
 * it attempts one only once the access token's own clock says it expired. A
 * token the API refuses for any other reason therefore left the session looking
 * healthy and every call failing into the error overlay.
 *
 * The file had no spec of its own, so nothing proved the redirect at all.
 */
const redirectMock = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const headersMock = jest.fn();
const authMock = jest.fn();

jest.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }));
jest.mock('next/headers', () => ({ headers: () => headersMock() }));
jest.mock('@/auth', () => ({ auth: () => authMock() }));
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  cache: <T>(fn: T) => fn,
}));

import { ApiError, serverApi } from './server';

const referer = (value: string | null) => ({ get: () => value });

const answers = (status: number, body: unknown = {}) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
};

describe('the authenticated client sends a refused caller to login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    headersMock.mockResolvedValue(referer('https://dev.kambriq.com/mylands?tab=all'));
    authMock.mockResolvedValue({ accessToken: 'a-token-the-api-no-longer-accepts' });
  });

  it('redirects on 401, keeping the page the caller was on', async () => {
    answers(401, { message: 'Unauthorized' });

    await expect(serverApi.get('/users/me')).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/login?callbackUrl=%2Fmylands%3Ftab%3Dall');
  });

  it('redirects before the request when the session already knows it is stale', async () => {
    authMock.mockResolvedValue({ accessToken: 'x', error: 'RefreshTokenError' });
    answers(200);

    await expect(serverApi.get('/users/me')).rejects.toThrow('NEXT_REDIRECT');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not redirect on 403, which is a refusal the caller must see', async () => {
    // A permission refusal is a correct answer to the question that was asked.
    // Turning it into a login redirect would hide a working guard.
    answers(403, { message: 'Forbidden' });

    await expect(serverApi.get('/lands/admin/payments')).rejects.toBeInstanceOf(ApiError);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('does not redirect on 500', async () => {
    answers(500, { message: 'Boom' });

    await expect(serverApi.get('/users/me')).rejects.toBeInstanceOf(ApiError);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('falls back to the root when there is no referer to return to', async () => {
    headersMock.mockResolvedValue(referer(null));
    answers(401, { message: 'Unauthorized' });

    await expect(serverApi.get('/users/me')).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/login?callbackUrl=%2F');
  });

  it('does not send the caller back to the login page it came from', async () => {
    headersMock.mockResolvedValue(referer('https://dev.kambriq.com/login?callbackUrl=%2F'));
    answers(401, { message: 'Unauthorized' });

    await expect(serverApi.get('/users/me')).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/login?callbackUrl=%2F');
  });
});
