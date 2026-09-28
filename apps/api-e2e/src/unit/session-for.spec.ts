import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SESSIONS_DIR_VAR, sessionFor } from '../journeys/support';

/**
 * The journeys sign in once per seeded account for the whole run: a second spec
 * file asking for the same account reads the token the first one stored. A unit
 * test - `fetch` is replaced and nothing reaches an environment.
 */
describe('sessionFor() - one sign-in per seeded account for the run', () => {
  const originalFetch = global.fetch;
  let dir: string;

  /** A token whose `exp` is `inSeconds` from now. */
  const jwt = (inSeconds: number) =>
    `h.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + inSeconds })).toString('base64url')}.s`;

  const signIns = (...tokens: string[]) => {
    const queue = [...tokens];
    const fetchMock = jest.fn(async () => {
      const token = queue.shift();
      if (token === undefined) throw new Error('signed in more times than the test allowed');
      return {
        status: 200,
        text: async () => JSON.stringify({ data: { tokens: { accessToken: token } } }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'session-for-'));
    process.env[SESSIONS_DIR_VAR] = dir;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env[SESSIONS_DIR_VAR];
    rmSync(dir, { recursive: true, force: true });
  });

  it('signs an account in once, and hands the same token to every later caller', async () => {
    const token = jwt(900);
    const fetchMock = signIns(token);

    expect(await sessionFor('admin@kambriq.com')).toBe(token);
    expect(await sessionFor('admin@kambriq.com')).toBe(token);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps one token per account', async () => {
    const fetchMock = signIns(jwt(900), jwt(900));
    await sessionFor('admin@kambriq.com');
    await sessionFor('eric.mbou@kambriq.com');
    await sessionFor('admin@kambriq.com');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('signs in again when the stored token is about to expire', async () => {
    const fresh = jwt(900);
    const fetchMock = signIns(jwt(60), fresh);
    await sessionFor('admin@kambriq.com');
    expect(await sessionFor('admin@kambriq.com')).toBe(fresh);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('signs in every time when the run has no session directory', async () => {
    delete process.env[SESSIONS_DIR_VAR];
    const fetchMock = signIns(jwt(900), jwt(900));
    await sessionFor('admin@kambriq.com');
    await sessionFor('admin@kambriq.com');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
