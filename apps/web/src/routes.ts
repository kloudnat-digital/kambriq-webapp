import { RoleCode } from '@/lib/roles';
import { routing } from '@/i18n/routing';

export const AUTH_ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY_EMAIL: '/verify-email',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  REACTIVATE: '/reactivate',
};

// Paths the middleware lets through without a session.
//
// Some entries are prefixes rather than pages: /legal, /products and
// /verify-certificate have no index page, so a bare request to them 404s while
// their sub-pages are public and reachable. isPublic() matches on `p` or
// `p + '/'`, so the prefix is doing real work and must not be "tidied away".
//
// /reactivate is listed and now has a page. It did not: lib/actions/auth.ts
// redirects there when the API answers REACTIVATION_REQUIRED, so a user in the
// soft-delete grace period was sent to a 404. The entry was always correct; the
// missing page was the bug.
//
// routes-have-pages.spec.ts now asserts that every entry here either resolves to
// a page or is declared prefix-only with at least one child, so the next entry
// added without a page fails in CI rather than in front of a user.
export const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/reactivate',
  '/about',
  '/contact',
  '/faq',
  '/blog',
  '/methode',
  '/plan',
  '/legal',
  '/products',
  '/verify-certificate',
];

export const REDIRECT_WHEN_AUTHED = ['/', '/login', '/register'];

/**
 * P3 - the prefixes the auth middleware actually guards.
 *
 * ---------------------------------------------------------------------------
 * Why this list exists, and what it replaced
 * ---------------------------------------------------------------------------
 * The middleware matcher used to be a **negative** pattern - everything except
 * `api`, `_next` and a handful of static files. So it ran on every URL the site
 * does not serve, decided they were not public, and redirected them to
 * `/login?callbackUrl=...`. `/pricing`, `/tarifs`, `/robots.txt` and
 * `/zzz-does-not-exist` all answered `307` to a login page. **No public URL on
 * the site could return a 404**, which is the audit's finding, and it makes
 * every typo look like a members' area.
 *
 * A negative matcher answers "what is not excluded", which is unbounded and
 * grows every time somebody adds a public page. A positive one answers "what is
 * protected", which is a list somebody can read and check.
 *
 * ---------------------------------------------------------------------------
 * Locale routing moved the weight from the matcher onto this list
 * ---------------------------------------------------------------------------
 * The matcher now also covers the public paths, because an unprefixed URL has
 * to reach the proxy to be redirected to a prefixed one. Being matched
 * therefore no longer implies being protected, and the proxy asks
 * `isProtected()` rather than negating `isPublic()`.
 *
 * That makes this list the guard rather than a description of one, and it is
 * the only thing standing between a protected page and an anonymous visitor.
 *
 * ---------------------------------------------------------------------------
 * Narrowing a gate is the dangerous direction
 * ---------------------------------------------------------------------------
 * Every prefix here was derived from the route files rather than remembered:
 * `middleware-matcher.spec.ts` walks `src/app`, computes each route's URL, and
 * fails if any route is neither public nor covered by this list. The two lists
 * have to account for every page on disk, so a new protected page that nobody
 * adds here fails at the commit rather than by being served to anonymous
 * visitors.
 *
 * `/kamnet` and `/kbs` stay protected deliberately. Public product pages link
 * straight at `/kamnet/apply` and `/kbs/enroll`, so an anonymous visitor
 * following a call to action meets a login wall - which is a real defect and is
 * **P5's**, not this chantier's. Making them work without an account is a
 * product change; silently widening the gate here would be that change, made
 * by accident and with no test to describe it.
 *
 * `/land` has no route today. It is in `ROLE_GATES` and is kept here so that a
 * future `/land/...` page is guarded on the day it is added rather than the day
 * somebody notices.
 */
export const PROTECTED_PREFIXES = [
  '/account',
  '/admin',
  '/agent',
  '/client',
  '/invite',
  '/kamnet',
  '/kbs',
  '/land',
  '/lands',
  '/mylands',
  '/profile',
  '/reservations',
  '/settings',
  '/welcome',
];

/**
 * Paths the middleware must still see even though they are public.
 *
 * `REDIRECT_WHEN_AUTHED` sends a signed-in user from `/`, `/login` and
 * `/register` to their role's home. That is not authentication, it is a
 * convenience - but it happens in the middleware, so narrowing the matcher to
 * protected prefixes alone would silently drop it and leave signed-in users
 * looking at the marketing page. Named separately from the protected list
 * because they are protecting nothing.
 */
export const AUTHED_REDIRECT_PATHS = REDIRECT_WHEN_AUTHED;

/**
 * P3 - reduces a `callbackUrl` to an internal path, or gives up and returns
 * `fallback`.
 *
 * ---------------------------------------------------------------------------
 * Nothing reads `callbackUrl` today, and that is exactly why this exists
 * ---------------------------------------------------------------------------
 * Four places **write** it - this middleware twice, `account/page.tsx`, and
 * `lib/api/server.ts` - and **no place reads it**: `logInAction` calls
 * `signIn(..., { redirectTo: '/' })`, a hard-coded literal. So there is no open
 * redirect on this site today, and the parameter is decorative.
 *
 * It is one line away from not being decorative. The obvious way to make the
 * parameter work is `redirectTo: searchParams.callbackUrl`, and written that
 * way it is a textbook open redirect: `/login?callbackUrl=https://evil.example`
 * sends somebody to another origin immediately after they typed a password.
 *
 * So the value is constrained where it is **written**, and this function is
 * exported so that whoever wires the read has the guard already sitting next to
 * the thing they are about to use.
 *
 * What is refused, and why each one:
 *
 * - `https://evil.example` - another origin;
 * - `//evil.example` - protocol-relative, which browsers resolve as an origin;
 * - `/\evil.example` and `\\evil.example` - backslashes, which several
 *   browsers normalise to `/` before resolving, so a lone leading `/` is not
 *   enough on its own;
 * - `javascript:...`, `data:...` - not navigations to a page at all;
 * - anything not starting with `/` - relative, so it resolves against whatever
 *   page happens to be current.
 */
export const safeCallbackUrl = (value: string | null | undefined, fallback = '/'): string => {
  if (typeof value !== 'string' || value.length === 0) return fallback;

  // A single leading slash, and the next character must not turn it into an
  // origin. This is deliberately a whitelist of shape rather than a blacklist
  // of schemes: a blacklist is a list of the tricks somebody has thought of.
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;
  if (value.startsWith('/\\')) return fallback;

  // Control characters, including the tab/newline that browsers strip before
  // parsing a URL - `/\tevil.example` is not the string it looks like.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;

  return value;
};

export const ROLE_GATES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: '/admin/kbs', roles: [RoleCode.ADMIN_KBS, RoleCode.ADMIN_GLOBAL] },
  { prefix: '/admin/kamnet', roles: [RoleCode.ADMIN_KAMNET, RoleCode.ADMIN_GLOBAL] },
  { prefix: '/admin/lands', roles: [RoleCode.ADMIN_LANDS, RoleCode.ADMIN_GLOBAL] },
  { prefix: '/admin/reservations', roles: [RoleCode.ADMIN_LANDS, RoleCode.ADMIN_GLOBAL] },
  { prefix: '/admin/verify', roles: [RoleCode.ADMIN_LANDS, RoleCode.ADMIN_GLOBAL] },
  { prefix: '/agent', roles: [RoleCode.AGENT, RoleCode.ADMIN_GLOBAL] },
  { prefix: '/land', roles: [RoleCode.AGENT, RoleCode.ADMIN_GLOBAL] },
];

export const ROLE_DEFAULTS: Record<string, string> = {
  [RoleCode.CLIENT]: '/mylands',
  [RoleCode.AGENT]: '/lands',
  [RoleCode.ADMIN_LANDS]: '/lands',
  [RoleCode.ADMIN_GLOBAL]: '/lands',
  [RoleCode.ADMIN_KBS]: '/admin/kbs',
  [RoleCode.ADMIN_KAMNET]: '/admin/kamnet',
};

export const ADMIN_LANDS_ROLES: readonly string[] = [RoleCode.ADMIN_LANDS, RoleCode.ADMIN_GLOBAL];

export const isAdminLands = (roles: string[]) => roles.some((r) => ADMIN_LANDS_ROLES.includes(r));

export const canManageReservations = (roles: string[]) =>
  isAdminLands(roles) || roles.includes(RoleCode.AGENT);

/**
 * Matches a leading locale segment: `/fr`, `/en`, and nothing else.
 *
 * The lookahead is what stops `/england` being read as the `en` locale
 * followed by `gland`. Built from `routing.locales` so a third locale reaches
 * this expression by being configured, not by being remembered.
 */
const LOCALE_SEGMENT = new RegExp(`^/(${routing.locales.join('|')})(?=/|$)`);

/**
 * Removes the locale prefix from a pathname.
 *
 * Every list in this file is written in unprefixed form, because a route's
 * identity does not change with the language it is served in. Callers strip
 * first and match afterwards.
 */
export const stripLocale = (pathname: string): string => {
  const stripped = pathname.replace(LOCALE_SEGMENT, '');
  return stripped === '' ? '/' : stripped;
};

/** The locale a pathname declares, or `undefined` when it carries none. */
export const localeOf = (pathname: string): string | undefined =>
  LOCALE_SEGMENT.exec(pathname)?.[1];

export const isPublic = (pathname: string) => {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
};

/**
 * Whether a pathname requires a session, asked positively.
 *
 * The proxy used to decide this by negation - anything `isPublic()` refused
 * was protected - and that was safe only because the matcher had already
 * excluded every URL the site does not serve. Locale routing widens the
 * matcher, because an unprefixed URL has to be redirected to a prefixed one
 * before anything can know whether a page exists behind it. Negation under a
 * wide matcher is the P3 defect exactly: every typo becomes a members' area.
 *
 * So the question is asked of this list instead, and `isPublic` no longer
 * decides anything on its own. The danger moves with it: a new protected page
 * whose prefix is missing here would be served to anybody. `middleware-matcher
 * .spec.ts` walks the route files and fails when a route is neither public nor
 * covered here, so the two lists have to account for every page on disk.
 */
export const isProtected = (pathname: string) => {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
};

/** Puts a locale back on an internal path: `/login` -> `/fr/login`. */
export const withLocale = (pathname: string, locale: string): string =>
  pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;

export const matchGate = (pathname: string) => {
  return ROLE_GATES.find((g) => pathname === g.prefix || pathname.startsWith(g.prefix + '/'));
};

export const getDefaultRoute = (roles: string[]) => {
  for (const r of roles) if (ROLE_DEFAULTS[r]) return ROLE_DEFAULTS[r];
  return '/mylands';
};
