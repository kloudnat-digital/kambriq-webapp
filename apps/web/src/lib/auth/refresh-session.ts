import { visitorHeaders } from '../api/visitor-headers';

/**
 * A47 - the web server remembers what each refresh token was exchanged for.
 *
 * Two facts, both measured on dev on 25 September:
 *
 * 1. **One navigation reads the session several times at once** - the proxy,
 *    the page, its server actions. Each read of an expired session called
 *    `/auth/refresh` with the same single-use refresh token: the first rotated
 *    it, the rest presented a revoked token and were refused (400), or collided
 *    with the first in the same second (409).
 *
 * 2. **Most refreshes are never saved.** Only the proxy writes the session
 *    cookie back to the browser; a plain `auth()` in a page or an action - and
 *    the root layout calls it on every page - drops the `set-cookie`
 *    (next-auth `lib/index.js`). On a page outside the proxy's matcher, a
 *    successful refresh was thrown away, the browser kept the token it had
 *    just revoked, the next refresh with it was refused, and the next protected
 *    page sent the person to login.
 *
 * So every refresh token presented maps to the outcome of refreshing it, and a
 * request follows that chain to the newest tokens before deciding anything.
 * A stale cookie is then harmless: it leads to the current tokens, which are
 * refreshed only when THEY are due, with THEIR refresh token - once, shared by
 * every request asking at the same moment. The cookie catches up the next time
 * the proxy runs.
 *
 * **The limit, stated.** The map lives in this web server's memory. A restart
 * forgets it, and a browser still holding a token that was exchanged before the
 * restart is then refused, exactly as every such browser was before this. With
 * several web tasks, each keeps its own map. One task runs on dev.
 */

/** How long an exchange is remembered: the longest refresh token lives 30 days. */
export const KEEP_FOR_MS = 30 * 24 * 60 * 60_000;

/** Refresh this long before the access token expires, as the jwt callback always has. */
export const REFRESH_AHEAD_MS = 60_000;

export type RefreshedTokens = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
};

/**
 * `refused` is the API saying no (400/401): that refresh token is finished,
 * and asking again only repeats the refusal. Anything else - a 5xx, a network
 * failure - may pass on the next attempt.
 */
export type RefreshOutcome =
  | { ok: true; tokens: RefreshedTokens }
  | { ok: false; refused: boolean };

type Entry = { promise: Promise<RefreshOutcome>; settledAt?: number };

/**
 * A47, second half - on `globalThis`, not in module scope. The proxy and the
 * pages are bundled as two module instances (two Turbopack runtime contexts)
 * in ONE Node process - measured on the build: the proxy is `server/middleware.js`,
 * CommonJS, requiring `node:async_hooks`, with no Edge function in the
 * middleware manifest. A module-level map was two maps; the global is one, so
 * a page renders with the tokens the proxy obtained for the same request.
 */
const STORE = Symbol.for('kambriq.web.refresh-session');
type Store = { byRefreshToken: Map<string, Entry>; lastSweep: number };
const globalStore = globalThis as unknown as Record<symbol, Store | undefined>;
const store: Store = (globalStore[STORE] ??= { byRefreshToken: new Map(), lastSweep: 0 });
const byRefreshToken = store.byRefreshToken;

const sweep = (now: number) => {
  if (now - store.lastSweep < 60_000) return;
  store.lastSweep = now;
  for (const [key, entry] of byRefreshToken) {
    if (entry.settledAt !== undefined && now - entry.settledAt > KEEP_FOR_MS) {
      byRefreshToken.delete(key);
    }
  }
};

const callApi = async (apiUrl: string, refreshToken: string): Promise<RefreshOutcome> => {
  try {
    const res = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await visitorHeaders()) },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return { ok: false, refused: res.status === 400 || res.status === 401 };
    const { data } = await res.json();
    return {
      ok: true,
      tokens: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? refreshToken,
        accessExpiresAt: new Date(data.accessExpiresAt).getTime(),
      },
    };
  } catch {
    return { ok: false, refused: false };
  }
};

/**
 * Exchanges one refresh token and records the outcome before the call returns,
 * synchronously - so a request arriving a moment later finds it in the map and
 * waits on it in `refreshSession`, instead of calling the API a second time.
 */
const exchange = (apiUrl: string, refreshToken: string): Promise<RefreshOutcome> => {
  const entry: Entry = {
    promise: callApi(apiUrl, refreshToken).then((outcome) => {
      entry.settledAt = Date.now();
      // A transient failure is forgotten at once, so the next request retries.
      if (!outcome.ok && !outcome.refused) byRefreshToken.delete(refreshToken);
      return outcome;
    }),
  };
  byRefreshToken.set(refreshToken, entry);
  return entry.promise;
};

/**
 * The current tokens for a session whose access token is due, starting from
 * whatever refresh token the browser still holds.
 */
export const refreshSession = async (
  apiUrl: string,
  presented: string,
): Promise<RefreshOutcome> => {
  sweep(Date.now());

  let current = presented;
  // Bounded: a chain longer than this would mean a loop, not a session.
  for (let hop = 0; hop < 1_000; hop += 1) {
    const known = byRefreshToken.get(current);
    if (!known) break;
    const outcome = await known.promise;
    if (!outcome.ok) return outcome;
    if (Date.now() < outcome.tokens.accessExpiresAt - REFRESH_AHEAD_MS) return outcome;
    current = outcome.tokens.refreshToken;
  }
  return exchange(apiUrl, current);
};

/**
 * A47, second half - what a page may know about a session, without calling.
 *
 * Follows the chain from the token the browser presented to the newest
 * exchange the proxy made, and returns it if its access token is still good,
 * or the refusal if the API refused. Anything else - nothing known, or tokens
 * that are due again - is `null`: a page never refreshes, because it cannot
 * write the cookie back.
 */
export const knownSession = async (presented: string): Promise<RefreshOutcome | null> => {
  let current = presented;
  for (let hop = 0; hop < 1_000; hop += 1) {
    const known = byRefreshToken.get(current);
    if (!known) return null;
    const outcome = await known.promise;
    if (!outcome.ok) return outcome.refused ? outcome : null;
    if (Date.now() < outcome.tokens.accessExpiresAt - REFRESH_AHEAD_MS) return outcome;
    current = outcome.tokens.refreshToken;
  }
  return null;
};
