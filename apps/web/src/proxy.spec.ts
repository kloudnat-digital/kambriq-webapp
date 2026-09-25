import {
  AUTH_ROUTES,
  PUBLIC_PATHS,
  REDIRECT_WHEN_AUTHED,
  ROLE_DEFAULTS,
  getDefaultRoute,
  withLocale,
} from './routes';

// proxy.ts is a pure decision over (pathname, session): it either lets the
// request through, redirects it, or hands it to next-intl. All three
// dependencies are stubbed so the assertions are about our branching, not about
// Next or next-intl internals.
//
// This suite exists because of a specific bug: a redirect loop shipped in May
// 2026 and was fixed by accident in August, and neither event was noticed. The
// first test below is that loop.

type Outcome = { kind: 'next' } | { kind: 'redirect'; url: string } | { kind: 'intl' };

jest.mock('next/server', () => ({
  NextResponse: {
    next: () => ({ kind: 'next' }),
    redirect: (url: URL) => ({ kind: 'redirect', url: url.toString() }),
  },
}));

/**
 * The next-intl middleware, as a distinguishable outcome rather than as `next`.
 *
 * The proxy hands it every request it does not answer itself, and that covers
 * two different decisions: "this URL has no locale, negotiate one" and "this
 * request is allowed through". Collapsing them into one value would let a
 * protected page that is wrongly handed straight to next-intl read as a pass.
 */
jest.mock('next-intl/middleware', () => ({
  __esModule: true,
  default: () => () => ({ kind: 'intl' }),
}));

// auth() wraps the handler in production. Unwrap it so the raw decision runs.
jest.mock('./auth', () => ({ authForProxy: (handler: unknown) => handler }));

import proxy from './proxy';

const ORIGIN = 'https://app.test';
const LOCALE = 'fr';

type Session = { user?: { roles?: string[] }; error?: string } | null;

/** Runs the proxy against a path exactly as given, prefix and all. */
const runRaw = (pathname: string, session: Session): Outcome =>
  (proxy as unknown as (req: unknown) => Outcome)({
    nextUrl: new URL(`${ORIGIN}${pathname}`),
    auth: session,
  });

/**
 * Runs the proxy against an internal path under the default locale.
 *
 * Every assertion about authentication belongs here rather than on a bare
 * path: the proxy hands anything without a locale straight to next-intl, so an
 * unprefixed `/mylands` proves nothing about the gate.
 */
const run = (pathname: string, session: Session): Outcome =>
  runRaw(withLocale(pathname, LOCALE), session);

const loginWithCallback = (path: string) =>
  `${ORIGIN}/${LOCALE}/login?callbackUrl=${encodeURIComponent(withLocale(path, LOCALE))}`;

const roleHome = (path: string) => `${ORIGIN}${withLocale(path, LOCALE)}`;

const authed = (roles: string[] = ['CLIENT']): Session => ({ user: { roles } });
const stale = (roles: string[] = ['CLIENT']): Session => ({
  user: { roles },
  error: 'RefreshTokenError',
});

const PROTECTED = ['/mylands', '/lands', '/reservations', '/admin/kbs', '/agent/dashboard', '/kbs'];

describe('proxy: the locale prefix comes first', () => {
  /**
   * A URL with no locale is negotiated before any authentication decision.
   *
   * It is what keeps every branch below reasoning about one shape of URL, and
   * it is why `/mylands` is not a redirect to login: the visitor is sent to
   * `/fr/mylands` first, and the gate answers on the next request.
   */
  it.each([...PUBLIC_PATHS, ...PROTECTED])('hands unprefixed %s to next-intl', (p) => {
    expect(runRaw(p, null)).toEqual({ kind: 'intl' });
  });

  it('recognises both locales as prefixes, and nothing else as one', () => {
    // A protected path under a real locale is gated.
    expect(runRaw('/fr/mylands', null).kind).toBe('redirect');
    expect(runRaw('/en/mylands', null).kind).toBe('redirect');
    // `/de` is not a locale, so `/de/mylands` is an unprefixed path whose first
    // segment happens to look like one. next-intl decides what to do with it.
    expect(runRaw('/de/mylands', null)).toEqual({ kind: 'intl' });
  });
});

describe('proxy: stale session (RefreshTokenError)', () => {
  // THE MAY LOOP. A stale session keeps its error flag until the user signs in
  // again, so redirecting to /login from /login bounced forever. If this fails,
  // the loop is back.
  it('renders /login rather than redirecting, when the session is stale', () => {
    expect(run(AUTH_ROUTES.LOGIN, stale())).toEqual({ kind: 'intl' });
  });

  it.each(PUBLIC_PATHS)('renders public path %s rather than redirecting', (p) => {
    // `/`, `/login` and `/register` send a signed-in user onward, and a stale
    // session is not signed in for that purpose - it is on its way to login.
    expect(run(p, stale())).toEqual({ kind: 'intl' });
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
    expect(run(p, null)).toEqual({ kind: 'intl' });
  });

  /**
   * P3, as an outcome rather than as a property of the matcher.
   *
   * The old gate was `!isPublic(pathname)`, and it was safe only because the
   * matcher had already excluded every URL the site does not serve. The matcher
   * is wider now - it has to see the public paths to redirect them to a locale -
   * so negation would send every typo to a login page and make the whole site
   * look like a members' area.
   *
   * Asking `isMatched` instead of running the proxy is what this used to do, and
   * it would not have caught the regression: under the new matcher these paths
   * ARE matched. Only the answer distinguishes them.
   */
  it.each([
    '/pricing',
    '/tarifs',
    '/zzz-does-not-exist',
    '/blog/a-post-that-moved',
    '/legal/does-not-exist',
  ])('does not send %s to login - it is unknown, not protected', (p) => {
    expect(run(p, null)).toEqual({ kind: 'intl' });
  });
});

describe('proxy: authenticated with a valid session', () => {
  it.each(['/', '/login', '/register'])(
    'redirects %s to the role home rather than showing it again',
    (p) => {
      expect(run(p, authed(['CLIENT']))).toEqual({ kind: 'redirect', url: roleHome('/mylands') });
    },
  );

  // The other half of the loop risk: if a role default were ever an auth route,
  // this branch would redirect /login to /login.
  it.each(Object.keys(ROLE_DEFAULTS))('sends %s from /login to a non-auth target', (role) => {
    const outcome = run('/login', authed([role])) as { kind: string; url: string };
    expect(outcome.kind).toBe('redirect');
    const target = new URL(outcome.url).pathname;
    expect(target).toBe(withLocale(getDefaultRoute([role]), LOCALE));
    expect(Object.values(AUTH_ROUTES).map((r) => withLocale(r, LOCALE))).not.toContain(target);
  });

  it('keeps the role home in the locale the request arrived in', () => {
    expect(runRaw('/en/login', authed(['CLIENT']))).toEqual({
      kind: 'redirect',
      url: `${ORIGIN}/en/mylands`,
    });
  });

  it('lets an ungated protected path through', () => {
    expect(run('/mylands', authed(['CLIENT']))).toEqual({ kind: 'intl' });
  });

  it('lets a gated path through for a role that holds the gate', () => {
    expect(run('/admin/kbs', authed(['ADMIN_KBS']))).toEqual({ kind: 'intl' });
    expect(run('/agent/dashboard', authed(['AGENT']))).toEqual({ kind: 'intl' });
  });

  it('redirects a gated path to the role home for a role that does not', () => {
    expect(run('/admin/kbs', authed(['CLIENT']))).toEqual({
      kind: 'redirect',
      url: roleHome('/mylands'),
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
      expect(
        outcome.kind === 'redirect' && outcome.url.startsWith(`${ORIGIN}/${LOCALE}/admin/kbs`),
      ).toBe(false);
    }
  });

  it('treats a missing roles array as no roles', () => {
    expect(run('/admin/kbs', { user: {} })).toEqual({
      kind: 'redirect',
      url: roleHome('/mylands'),
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
        expect(new URL(outcome.url).pathname).not.toBe(withLocale(p, LOCALE));
      }
    }
  });
});

/**
 * A47. The proxy RUNS on every public page, and running must not become gating.
 *
 * The root layout reads the session on every page, and only the proxy can write
 * a refreshed session cookie back to the browser - NextAuth appends the
 * session's `set-cookie` onto whatever response the handler returns. A public
 * page the proxy never saw therefore refreshed where nothing could save the
 * result, and browsing two of them signed the person out.
 *
 * A47 met this by listing each public page in the matcher one at a time. Locale
 * routing already meets it and more completely - `/(fr|en)/:path*` matches every
 * URL the app links to - so this asserts the PROPERTY rather than the list: a
 * public page lets every kind of session through, whatever the matcher looks
 * like. Written against `PUBLIC_PATHS` instead of parsed out of `config.matcher`
 * for that reason; a test that reads the matcher would pass by agreeing with
 * whatever the matcher happens to say.
 *
 * `/`, `/login` and `/register` are excluded from the signed-in case only: the
 * proxy has always sent a signed-in person onward from those three.
 */
describe('proxy: public pages it runs on are never gated (A47)', () => {
  it('has public pages to check', () => {
    // A list that went empty would make every assertion below vacuous.
    expect(PUBLIC_PATHS.length).toBeGreaterThan(10);
  });

  it.each(PUBLIC_PATHS)('lets an anonymous visitor through %s', (p) => {
    expect(run(p, null)).toEqual({ kind: 'intl' });
  });

  it.each(PUBLIC_PATHS.filter((p) => !REDIRECT_WHEN_AUTHED.includes(p)))(
    'lets a signed-in person, and a stale session, through %s',
    (p) => {
      expect(run(p, authed())).toEqual({ kind: 'intl' });
      expect(run(p, stale())).toEqual({ kind: 'intl' });
    },
  );

  it('runs on a public page rather than skipping it, in both locales', () => {
    // The half that makes the rest mean something: `intl` is the outcome for a
    // page the proxy HANDLED. A page it never matched would never reach here.
    for (const locale of ['fr', 'en']) {
      expect(runRaw(`/${locale}/about`, authed())).toEqual({ kind: 'intl' });
      expect(runRaw(`/${locale}/legal/privacy`, authed())).toEqual({ kind: 'intl' });
    }
  });
});
