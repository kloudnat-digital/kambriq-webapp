jest.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: (config: object) => ({ id: 'credentials', type: 'credentials', ...config }),
}));
jest.mock('./lib/api/visitor-headers', () => ({ visitorHeaders: async () => ({}) }));

import authConfig from './auth.config';
import { KEEP_FOR_MS } from './lib/auth/refresh-session';

/**
 * A47 - a session survives its access token's expiry.
 *
 * What the API's request log showed on dev (7 days, 17-25 September): the web
 * refreshed in BURSTS. Several server requests read the same session at once -
 * the proxy, the page, its server actions - each saw an expired access token,
 * and each called `/auth/refresh` with the same single-use refresh token. The
 * first rotated it; the others presented a token the API had just revoked and
 * got 400, and two that passed the check in the same second collided on the
 * token's unique index and got 409. A request that lost marked the session
 * `RefreshTokenError`. And a session whose refresh token had expired retried on
 * every page load, forever: that is the burst A41 measured.
 *
 * These call the real `jwt` callback from `auth.config.ts`.
 */
type Token = Record<string, unknown>;
const jwt = authConfig.callbacks?.jwt as unknown as (p: { token: Token }) => Promise<Token>;
if (typeof jwt !== 'function') throw new Error('auth.config.ts no longer defines callbacks.jwt');

const fetchMock = jest.fn();
beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});
beforeEach(() => fetchMock.mockReset());

/** An expired session. Each test uses its own refresh token, so none shares a cache entry. */
const expired = (refreshToken: string): Token => ({
  user: { id: 'u1' },
  accessToken: 'old-access',
  refreshToken,
  accessExpiresAt: Date.now() - 1_000,
});

const refreshCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/v1/auth/refresh')).length;

const answers = (status: number, delayMs = 20) =>
  fetchMock.mockImplementation(
    () =>
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              ok: status >= 200 && status < 300,
              status,
              json: async () =>
                status === 200
                  ? {
                      data: {
                        accessToken: 'new-access',
                        refreshToken: 'new-refresh',
                        accessExpiresAt: new Date(Date.now() + 900_000).toISOString(),
                      },
                    }
                  : { message: 'refused' },
            }),
          delayMs,
        ),
      ),
  );

describe('A47 - the session refresh', () => {
  it('refreshes ONCE when several requests read the same expired session at the same time', async () => {
    answers(200);
    const results = await Promise.all([1, 2, 3].map(() => jwt({ token: expired('rt-burst') })));

    expect(refreshCalls()).toBe(1);
    expect(results.map((t) => t['accessToken'])).toEqual([
      'new-access',
      'new-access',
      'new-access',
    ]);
    expect(results.every((t) => t['error'] === undefined)).toBe(true);
  });

  it('hands the new tokens to a request that still carries the old one, without calling again', async () => {
    // The page renders against the cookie the browser sent, which the proxy
    // has just rotated. Calling again with that token is a guaranteed 400.
    answers(200);
    await jwt({ token: expired('rt-replay') });
    const late = await jwt({ token: expired('rt-replay') });

    expect(refreshCalls()).toBe(1);
    expect(late['accessToken']).toBe('new-access');
    expect(late['error']).toBeUndefined();
  });

  it('stops asking once the API has refused the refresh token, long after the refusal', async () => {
    answers(400);
    const refused = await jwt({ token: expired('rt-refused') });
    expect(refused['error']).toBe('RefreshTokenError');

    // Past the time the web remembers the refusal for: only the session's own
    // record of it can stop the next call - as after a restart of the web.
    const later = Date.now() + KEEP_FOR_MS + 120_000;
    const clock = jest.spyOn(Date, 'now').mockReturnValue(later);
    try {
      await jwt({ token: refused });
      await jwt({ token: refused });
    } finally {
      clock.mockRestore();
    }
    expect(refreshCalls()).toBe(1);
  });

  it('asks again after a failure that was not a refusal', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const failed = await jwt({ token: expired('rt-transient') });
    expect(failed['error']).toBe('RefreshTokenError');

    answers(200);
    const retried = await jwt({ token: failed });
    expect(refreshCalls()).toBe(2);
    expect(retried['accessToken']).toBe('new-access');
    expect(retried['error']).toBeUndefined();
  });

  /**
   * A page that is not behind the proxy renders `auth()` itself, and next-auth
   * throws away the cookie such a render produces (`lib/index.js`: plain
   * `auth()` returns `r.json()` and drops `set-cookie`). The browser keeps
   * presenting the token that refresh has just revoked, long after any short
   * window. Measured on dev: the next refresh with it was refused, and the next
   * protected page sent the person to login.
   */
  it('keeps honouring a refresh whose cookie was never written, minutes later', async () => {
    answers(200);
    await jwt({ token: expired('rt-unsaved') });

    const later = Date.now() + 5 * 60_000;
    const clock = jest.spyOn(Date, 'now').mockReturnValue(later);
    try {
      const again = await jwt({ token: expired('rt-unsaved') });
      expect(again['accessToken']).toBe('new-access');
      expect(again['error']).toBeUndefined();
    } finally {
      clock.mockRestore();
    }
    expect(refreshCalls()).toBe(1);
  });

  it('refreshes the NEWEST token when the one the browser still holds has been exchanged', async () => {
    answers(200);
    await jwt({ token: expired('rt-chain') });

    // The tokens issued at the first refresh have expired in turn.
    const later = Date.now() + 16 * 60_000;
    const clock = jest.spyOn(Date, 'now').mockReturnValue(later);
    try {
      await jwt({ token: expired('rt-chain') });
    } finally {
      clock.mockRestore();
    }
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body ?? '{}')));
    expect(bodies.map((b) => b.refreshToken)).toEqual(['rt-chain', 'new-refresh']);
  });

  it('does not refresh a session whose access token is still valid', async () => {
    answers(200);
    const fresh = { ...expired('rt-fresh'), accessExpiresAt: Date.now() + 600_000 };
    expect(await jwt({ token: fresh })).toBe(fresh);
    expect(refreshCalls()).toBe(0);
  });
});
