import {
  AUTH_ROUTES,
  PUBLIC_PATHS,
  REDIRECT_WHEN_AUTHED,
  ROLE_DEFAULTS,
  getDefaultRoute,
  isPublic,
} from './routes';

// proxy.ts is a pure decision over (pathname, session): it either lets the
// request through or redirects it. Both dependencies are stubbed so the
// assertions are about our branching, not about Next internals.
//
// This suite exists because of a specific bug: a redirect loop shipped in May
// 2026 and was fixed by accident in August, and neither event was noticed. The
// first test below is that loop.

type Outcome = { kind: 'next' } | { kind: 'redirect'; url: string };

jest.mock('next/server', () => ({
  NextResponse: {
    next: () => ({ kind: 'next' }),
    redirect: (url: URL) => ({ kind: 'redirect', url: url.toString() }),
  },
}));

// auth() wraps the handler in production. Unwrap it so the raw decision runs.
jest.mock('./auth', () => ({ authForProxy: (handler: unknown) => handler }));

import proxy, { config } from './proxy';

const ORIGIN = 'https://app.test';

type Session = { user?: { roles?: string[] }; error?: string } | null;

const run = (pathname: string, session: Session): Outcome =>
  (proxy as unknown as (req: unknown) => Outcome)({
    nextUrl: new URL(`${ORIGIN}${pathname}`),
    auth: session,
  });

const loginWithCallback = (path: string) =>
  `${ORIGIN}/login?callbackUrl=${encodeURIComponent(path)}`;

const authed = (roles: string[] = ['CLIENT']): Session => ({ user: { roles } });
const stale = (roles: string[] = ['CLIENT']): Session => ({
  user: { roles },
  error: 'RefreshTokenError',
});

const PROTECTED = ['/mylands', '/lands', '/reservations', '/admin/kbs', '/agent/dashboard', '/kbs'];

describe('proxy: stale session (RefreshTokenError)', () => {
  // THE MAY LOOP. A stale session keeps its error flag until the user signs in
  // again, so redirecting to /login from /login bounced forever. If this fails,
  // the loop is back.
  it('renders /login rather than redirecting, when the session is stale', () => {
    expect(run(AUTH_ROUTES.LOGIN, stale())).toEqual({ kind: 'next' });
  });

  it.each(PUBLIC_PATHS)('renders public path %s rather than redirecting', (p) => {
    expect(run(p, stale())).toEqual({ kind: 'next' });
  });

  it.each(PROTECTED)('redirects %s to /login with the callbackUrl', (p) => {
    expect(run(p, stale())).toEqual({ kind: 'redirect', url: loginWithCallback(p) });
  });
});

describe('proxy: unauthenticated', () => {
  it.each(PROTECTED)('redirects %s to /login with the callbackUrl', (p) => {
    expect(run(p, null)).toEqual({ kind: 'redirect', url: loginWithCallback(p) });
  });

  it.each(PUBLIC_PATHS)('lets public path %s through', (p) => {
    expect(run(p, null)).toEqual({ kind: 'next' });
  });
});

describe('proxy: authenticated with a valid session', () => {
  it.each(['/', '/login', '/register'])(
    'redirects %s to the role home rather than showing it again',
    (p) => {
      const outcome = run(p, authed(['CLIENT']));
      expect(outcome).toEqual({ kind: 'redirect', url: `${ORIGIN}/mylands` });
    },
  );

  // The other half of the loop risk: if a role default were ever an auth route,
  // this branch would redirect /login to /login.
  it.each(Object.keys(ROLE_DEFAULTS))('sends %s from /login to a non-auth target', (role) => {
    const outcome = run('/login', authed([role])) as { kind: string; url: string };
    expect(outcome.kind).toBe('redirect');
    const target = new URL(outcome.url).pathname;
    expect(target).toBe(getDefaultRoute([role]));
    expect(Object.values(AUTH_ROUTES)).not.toContain(target);
  });

  it('lets an ungated protected path through', () => {
    expect(run('/mylands', authed(['CLIENT']))).toEqual({ kind: 'next' });
  });

  it('lets a gated path through for a role that holds the gate', () => {
    expect(run('/admin/kbs', authed(['ADMIN_KBS']))).toEqual({ kind: 'next' });
    expect(run('/agent/dashboard', authed(['AGENT']))).toEqual({ kind: 'next' });
  });

  it('redirects a gated path to the role home for a role that does not', () => {
    expect(run('/admin/kbs', authed(['CLIENT']))).toEqual({
      kind: 'redirect',
      url: `${ORIGIN}/mylands`,
    });
  });

  /**
   * I18 - /admin/kbs has one gate, and this is it.
   *
   * `admin/kbs/layout.tsx` carried a second check, `['ADMIN_KBS', 'ADMIN_GLOBAL',
   * 'ROOT']`, and had already diverged from this one: it admitted `ROOT`, a role
   * that exists nowhere, which this gate never did. The layout check is removed
   * (decided 15 September); what is left must refuse everybody else on its own.
   */
  it.each([
    ['ROOT, the role the layout used to admit', ['ROOT']],
    ['every other administration', ['ADMIN_LANDS', 'ADMIN_KAMNET']],
    ['an agent who is also a client', ['AGENT', 'CLIENT', 'KCA_CERTIFIED', 'CANDIDATE_KBS']],
  ])('refuses /admin/kbs and its pages to %s', (_label, roles) => {
    for (const path of ['/admin/kbs', '/admin/kbs/candidates', '/admin/kbs/certificates']) {
      const outcome = run(path, authed(roles));
      expect(outcome.kind).toBe('redirect');
      expect(outcome.kind === 'redirect' && outcome.url.startsWith(`${ORIGIN}/admin/kbs`)).toBe(
        false,
      );
    }
  });

  it('treats a missing roles array as no roles', () => {
    expect(run('/admin/kbs', { user: {} })).toEqual({
      kind: 'redirect',
      url: `${ORIGIN}/mylands`,
    });
  });
});

describe('proxy: no decision loops', () => {
  // Whatever the input, a redirect must never point at the path it came from.
  const sessions: Array<[string, Session]> = [
    ['unauthenticated', null],
    ['stale', stale()],
    ['authed client', authed(['CLIENT'])],
    ['authed admin', authed(['ADMIN_GLOBAL'])],
  ];
  const paths = [...PUBLIC_PATHS, ...PROTECTED];

  it.each(sessions)('never redirects a path to itself for a %s session', (_label, session) => {
    for (const p of paths) {
      const outcome = run(p, session);
      if (outcome.kind === 'redirect') {
        expect(new URL(outcome.url).pathname).not.toBe(p);
      }
    }
  });
});

/**
 * A47. The proxy now RUNS on every public page, so that a refresh it needs is
 * written back to the browser. Running must not become gating: every public
 * literal in the matcher, walked through the real decision, lets an anonymous
 * visitor through - and a signed-in or stale session through as well, except
 * where the proxy always sent a signed-in person onward (`/`, `/login`,
 * `/register`).
 */
describe('proxy: public pages it runs on are never gated (A47)', () => {
  const publicLiterals = (config.matcher as string[])
    .filter((m) => isPublic(m.split('/:')[0] || '/'))
    .map((m) => m.replace(/:[A-Za-z]+$/, 'KCA-20260925-0001'));

  it('has public pages to check', () => {
    expect(publicLiterals.length).toBeGreaterThan(20);
  });

  it.each(publicLiterals)('lets an anonymous visitor through %s', (p) => {
    expect(run(p, null)).toEqual({ kind: 'next' });
  });

  it.each(publicLiterals.filter((p) => !REDIRECT_WHEN_AUTHED.includes(p)))(
    'lets a signed-in person, and a stale session, through %s',
    (p) => {
      expect(run(p, authed())).toEqual({ kind: 'next' });
      expect(run(p, stale())).toEqual({ kind: 'next' });
    },
  );
});
