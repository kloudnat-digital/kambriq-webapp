jest.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: (config: object) => ({ id: 'credentials', type: 'credentials', ...config }),
}));
jest.mock('./lib/api/visitor-headers', () => ({ visitorHeaders: async () => ({}) }));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import authConfig, { pageAuthConfig } from './auth.config';
import type * as RefreshSessionModule from './lib/auth/refresh-session';

/**
 * A47, second half - a page render never rotates the refresh token.
 *
 * Only the proxy writes the session cookie back to the browser; a plain
 * `auth()` in a page or an action drops the `set-cookie` (next-auth
 * `lib/index.js`). A refresh started by a page therefore revoked the token the
 * browser held and saved nothing in its place - and on 25 September, browsing
 * two public pages after the access token fell due signed the person out, on
 * develop at 04:58 and again, after #171, at 05:36.
 *
 * So pages read the session with `pageAuthConfig`, whose `jwt` never calls the
 * API. It takes the tokens the proxy obtained for the same request - shared
 * through `globalThis`, because the proxy and the pages are bundled as two
 * module instances in one Node process (measured on the build, see the PR) -
 * and otherwise leaves the session exactly as it found it.
 */
type Token = Record<string, unknown>;
type Jwt = (p: { token: Token }) => Promise<Token>;
const asJwt = (fn: unknown): Jwt => {
  if (typeof fn !== 'function') throw new Error('auth.config.ts no longer defines callbacks.jwt');
  return fn as Jwt;
};
const proxyJwt = asJwt(authConfig.callbacks?.jwt);
const pageJwt = asJwt(pageAuthConfig.callbacks?.jwt);

const fetchMock = jest.fn();
beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});
beforeEach(() => fetchMock.mockReset());

const expired = (refreshToken: string): Token => ({
  user: { id: 'u1' },
  accessToken: 'old-access',
  refreshToken,
  accessExpiresAt: Date.now() - 1_000,
});
const refreshCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/v1/auth/refresh')).length;
const answers200 = () =>
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        accessExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      },
    }),
  });

describe('A47 - a page render reads the session, it never refreshes it', () => {
  it('does not call the refresh endpoint for an expired session', async () => {
    answers200();
    const token = expired('rt-page-alone');
    const read = await pageJwt({ token });

    expect(refreshCalls()).toBe(0);
    expect(read['refreshToken']).toBe('rt-page-alone');
  });

  it('takes the tokens the proxy obtained for the same request, without calling', async () => {
    answers200();
    await proxyJwt({ token: expired('rt-proxy-first') });
    const read = await pageJwt({ token: expired('rt-proxy-first') });

    expect(refreshCalls()).toBe(1);
    expect(read['accessToken']).toBe('new-access');
    expect(read['error']).toBeUndefined();
  });

  it('shows a refusal the proxy recorded as a broken session, without calling', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({}) });
    await proxyJwt({ token: expired('rt-refused-by-api') });
    const read = await pageJwt({ token: expired('rt-refused-by-api') });

    expect(refreshCalls()).toBe(1);
    expect(read['error']).toBe('RefreshTokenError');
    expect(read['refreshRefused']).toBe(true);
  });

  it('shares the exchanges across two module instances, as the proxy and pages are bundled', async () => {
    let proxyCopy: typeof RefreshSessionModule | undefined;
    let pageCopy: typeof RefreshSessionModule | undefined;
    jest.isolateModules(() => {
      proxyCopy = jest.requireActual('./lib/auth/refresh-session');
    });
    jest.isolateModules(() => {
      pageCopy = jest.requireActual('./lib/auth/refresh-session');
    });
    if (!proxyCopy || !pageCopy) throw new Error('refresh-session did not load');
    expect(proxyCopy).not.toBe(pageCopy);

    answers200();
    await proxyCopy.refreshSession('https://api.test', 'rt-two-instances');
    const seen = await pageCopy.knownSession('rt-two-instances');

    expect(seen?.ok && seen.tokens.accessToken).toBe('new-access');
  });
});

/**
 * The split only holds if the right instance reaches the right place: pages
 * and actions get the read-only `auth`, the proxy gets the refreshing one.
 * Swapping either is one edit that looks like tidying.
 */
describe('A47 - who gets which session reader', () => {
  const read = (f: string) => readFileSync(join(__dirname, f), 'utf8');

  it('auth.ts builds the `auth` pages import from pageAuthConfig', () => {
    expect(read('auth.ts')).toMatch(
      /export const \{ auth \} = NextAuth\(\{[\s\S]*?\.\.\.pageAuthConfig,?\s*\}\);/,
    );
  });

  it('the proxy wraps itself in the instance that refreshes', () => {
    expect(read('proxy.ts')).toMatch(/import \{ authForProxy as auth \} from '\.\/auth';/);
  });
});
