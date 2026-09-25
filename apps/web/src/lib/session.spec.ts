import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Session } from 'next-auth';

import { sessionForClient } from './session';

/**
 * The API bearer token must not reach a browser.
 *
 * It lives in the encrypted session cookie so that server code can attach it to
 * backend calls. `<Providers>` is a Client Component, so everything handed to it
 * is serialised into the RSC payload every browser downloads - and the root
 * layout handed it the whole `auth()` result. The token was published on every
 * authenticated page for as long as that line existed.
 *
 * Three things are checked, because each covers a different way it comes back:
 * the function that strips it, the call site that has to use it, and the type
 * that has to refuse it. A fourth lives in `apps/web-e2e/src/auth.spec.ts`,
 * which logs in against a running app and reads the delivered HTML - the only
 * one of the four that observes the actual outcome.
 */
const SESSION: Session = {
  user: {
    id: 'u1',
    email: 'someone@example.com',
    firstName: 'A',
    lastName: 'B',
    roles: ['CLIENT'],
    language: 'fr',
  },
  accessToken: 'a-token-no-browser-may-see',
  expires: '2099-01-01T00:00:00.000Z',
} as Session;

const WEB_SRC = join(__dirname, '..');
const read = (...parts: string[]) => readFileSync(join(WEB_SRC, ...parts), 'utf8');

describe('the session that crosses into client code', () => {
  it('carries no access token', () => {
    const forClient = sessionForClient(SESSION);

    expect(forClient).not.toBeNull();
    expect(Object.keys(forClient as object)).not.toContain('accessToken');
    expect(JSON.stringify(forClient)).not.toContain('a-token-no-browser-may-see');
  });

  it('keeps everything the client legitimately needs', () => {
    // A strip that emptied the session would pass the assertion above and break
    // every `useSession()` caller instead.
    const forClient = sessionForClient(SESSION);

    expect(forClient?.user).toEqual(SESSION.user);
    expect(forClient?.expires).toBe(SESSION.expires);
  });

  it('passes a missing session through as null', () => {
    expect(sessionForClient(null)).toBeNull();
  });

  it('does not mutate the session the server still holds', () => {
    // The server's own copy is the one `lib/api/server.ts` reads to build the
    // Authorization header. Stripping in place would log every user out.
    const original = { ...SESSION };
    sessionForClient(SESSION);
    expect(SESSION).toEqual(original);
    expect(SESSION.accessToken).toBe('a-token-no-browser-may-see');
  });

  it('is what the root layout hands to Providers', () => {
    /**
     * The call site, not the function.
     *
     * `sessionForClient` being correct proves nothing if the layout goes back
     * to `<Providers session={await auth()}>`, which is one edit away and reads
     * as a simplification.
     */
    const layout = read('app', '[locale]', 'layout.tsx');

    expect(layout).toContain('sessionForClient(await auth())');
    expect(layout).toMatch(/<Providers session=\{session\}>/);
  });

  it('is what the Providers prop type will accept', () => {
    // `ClientSession` is `Omit<Session, 'accessToken'>`. Typed as `Session`,
    // the compiler would accept the raw one again and nothing would report it.
    const providers = read('components', 'providers.tsx');

    expect(providers).toContain('ClientSession');
    expect(providers).not.toMatch(/session: Session \| null/);
  });
});
