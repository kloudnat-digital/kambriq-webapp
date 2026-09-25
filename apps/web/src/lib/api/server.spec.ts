/**
 * Tests for the authenticated API client, specifically handling token rejection.
 * Validates that `authedFetch` triggers a redirect to the login page when the API
 * rejects a token (e.g., HTTP 401), regardless of local expiration status.
 */
const redirectMock = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const headersMock = jest.fn();
const authMock = jest.fn();

jest.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }));
// `cookies` joins `headers` here because the login redirect now resolves the
// locale for the URL it redirects to, and falls back to the locale cookie when
// the request carries no referer. See lib/locale.ts.
jest.mock('next/headers', () => ({
  headers: () => headersMock(),
  cookies: () => Promise.resolve({ get: () => undefined }),
}));
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
    expect(redirectMock).toHaveBeenCalledWith('/fr/login?callbackUrl=%2Fmylands%3Ftab%3Dall');
  });

  it('redirects before the request when the session already knows it is stale', async () => {
    authMock.mockResolvedValue({ accessToken: 'x', error: 'RefreshTokenError' });
    answers(200);

    await expect(serverApi.get('/users/me')).rejects.toThrow('NEXT_REDIRECT');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not redirect on 403, which is a refusal the caller must see', async () => {
    // Ensure HTTP 403 Forbidden is propagated to the caller and does not trigger a redirect.
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
    expect(redirectMock).toHaveBeenCalledWith('/fr/login?callbackUrl=%2F');
  });

  it('does not send the caller back to the login page it came from', async () => {
    headersMock.mockResolvedValue(referer('https://dev.kambriq.com/login?callbackUrl=%2F'));
    answers(401, { message: 'Unauthorized' });

    await expect(serverApi.get('/users/me')).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/fr/login?callbackUrl=%2F');
  });
});
