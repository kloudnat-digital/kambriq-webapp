import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { authForProxy as auth } from './auth';
import { routing } from './i18n/routing';
import {
  AUTH_ROUTES,
  getDefaultRoute,
  isProtected,
  localeOf,
  matchGate,
  REDIRECT_WHEN_AUTHED,
  safeCallbackUrl,
  stripLocale,
  withLocale,
} from './routes';

/**
 * next-intl's locale negotiation, which produces the final response for every
 * request this proxy does not answer itself.
 *
 * It redirects an unprefixed pathname to a prefixed one, records the choice in
 * the `NEXT_LOCALE` cookie, and sets the `Link: <...>; rel="alternate"` headers
 * that tell a crawler about the other language.
 */
const intl = createMiddleware(routing);

export default auth((req) => {
  const { nextUrl, auth: session } = req;

  /**
   * A pathname with no locale is sent to the prefixed form before any
   * authentication decision is taken.
   *
   * It keeps every branch below reasoning about one shape of URL, and it lets
   * next-intl pick the locale from the cookie or `accept-language` rather than
   * this file guessing one. The cost is one extra redirect on a hand-typed URL;
   * every link the app renders is prefixed already.
   */
  if (!localeOf(nextUrl.pathname)) return intl(req);

  const locale = localeOf(nextUrl.pathname) as string;
  const pathname = stripLocale(nextUrl.pathname);
  const isAuthenticated = !!session?.user;
  const hasSessionError = session?.error === 'RefreshTokenError';
  const roles = session?.user?.roles ?? [];

  const toLogin = () => {
    const loginUrl = new URL(withLocale(AUTH_ROUTES.LOGIN, locale), nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', safeCallbackUrl(nextUrl.pathname));
    return NextResponse.redirect(loginUrl);
  };

  const toHome = () =>
    NextResponse.redirect(new URL(withLocale(getDefaultRoute(roles), locale), nextUrl.origin));

  // Refresh failed. The session keeps its error flag until the user signs in
  // again, so this is scoped to protected paths: applied to /login as well it
  // would bounce login to itself.
  if (isAuthenticated && hasSessionError && isProtected(pathname)) return toLogin();

  // Authenticated user on the landing or auth pages goes to their role's home.
  if (isAuthenticated && !hasSessionError) {
    const shouldRedirect = REDIRECT_WHEN_AUTHED.some((p) =>
      p === '/' ? pathname === '/' : pathname.startsWith(p),
    );
    if (shouldRedirect) return toHome();
  }

  /**
   * The authentication gate, asked positively.
   *
   * This was `!isPublic(pathname)`, which was safe only while the matcher
   * excluded every URL the site does not serve. The matcher now has to see the
   * public paths too, so negation here would send `/fr/pricing` and every typo
   * to the login page - the P3 defect, reintroduced through i18n.
   */
  if (!isAuthenticated && isProtected(pathname)) return toLogin();

  if (isAuthenticated) {
    const gate = matchGate(pathname);
    if (gate && !gate.roles.some((r) => roles.includes(r))) return toHome();
  }

  return intl(req);
});

/**
 * The proxy runs on the URLs this site serves, and on nothing else.
 *
 * ---------------------------------------------------------------------------
 * What this replaced, and why the shape matters more than the list
 * ---------------------------------------------------------------------------
 * This used to be one **negative** pattern: everything except `api`, `_next`
 * and some static files. So the proxy ran on every URL the site does not
 * serve, found it was not in `PUBLIC_PATHS`, and redirected it to
 * `/login?callbackUrl=...`. Measured against the running app before P3:
 *
 *   /zzz-does-not-exist  307 -> /login?callbackUrl=%2Fzzz-does-not-exist
 *   /pricing             307 -> /login?callbackUrl=%2Fpricing
 *   /tarifs              307 -> /login?callbackUrl=%2Ftarifs
 *   /robots.txt          307 -> /login?callbackUrl=%2Frobots.txt
 *   /api/does-not-exist  404          <- the only path that could 404 at all
 *
 * **A negative matcher is a list of what is not excluded**, which is unbounded,
 * grows silently with every new public page, and cannot answer "is this URL
 * protected" without running it. A positive one is a list a person can read.
 *
 * next-intl documents `'/((?!api|trpc|_next|_vercel|.*\\..*).*)'` for this file,
 * which is that exact pattern. It is not used here.
 *
 * ---------------------------------------------------------------------------
 * The three locale entries, and the sixty unprefixed ones
 * ---------------------------------------------------------------------------
 * `/(fr|en)/:path*` covers every URL that declares a locale, which after this
 * change is every URL the app links to. It is a catch-all in reach and still a
 * positive statement: the dangerous direction - a protected page the proxy does
 * not see - cannot happen under it, because a protected page is always
 * locale-prefixed. Next compiles the alternation through path-to-regexp, so it
 * discriminates: `/de/admin` and `/administration` do not match.
 *
 * The unprefixed entries exist only so that a URL typed or bookmarked without a
 * locale is redirected rather than answered with a 404. They are the public
 * paths and the protected prefixes, each in bare and `/:path*` form. Nothing
 * else is listed, so `/pricing` never reaches this file and Next answers it
 * from `app/[locale]/not-found.tsx`.
 *
 * Being matched no longer implies being protected. That decision moved into the
 * handler above and rests on `PROTECTED_PREFIXES`, and
 * `middleware-matcher.spec.ts` holds both halves: the literals here against the
 * lists in `routes.ts`, and the lists against the route files on disk.
 */
export const config = {
  matcher: [
    // Every URL that declares a locale, plus the two roots.
    '/',
    '/(fr|en)',
    '/(fr|en)/:path*',

    // Unprefixed forms, so they are redirected to a locale rather than 404ing.
    // Keep in step with PUBLIC_PATHS and PROTECTED_PREFIXES in routes.ts.
    //
    // A47 requires the proxy to RUN on every public page: the root layout reads
    // the session on every page, only the proxy can write a refreshed session
    // cookie back, and a page the proxy never saw refreshed where nothing could
    // save it - browsing two of them signed the person out. A47 met that by
    // listing each public page here one at a time.
    //
    // Locale routing already meets it, and more completely: `/(fr|en)/:path*`
    // above matches every locale-prefixed URL, which after wave 5 is every URL
    // the app links to, and the entries below add the unprefixed forms. The
    // one-page-at-a-time list was A47's way of keeping an unknown URL unmatched
    // so it still 404s; here that property does not rest on the matcher at all
    // but on the handler asking `isProtected()` positively, which is asserted
    // by running the proxy rather than by reading the list.
    '/about',
    '/about/:path*',
    '/account',
    '/account/:path*',
    '/admin',
    '/admin/:path*',
    '/agent',
    '/agent/:path*',
    '/blog',
    '/blog/:path*',
    '/client',
    '/client/:path*',
    '/contact',
    '/contact/:path*',
    '/faq',
    '/faq/:path*',
    '/forgot-password',
    '/forgot-password/:path*',
    '/invite',
    '/invite/:path*',
    '/kamnet',
    '/kamnet/:path*',
    '/kbs',
    '/kbs/:path*',
    '/land',
    '/land/:path*',
    '/lands',
    '/lands/:path*',
    '/legal',
    '/legal/:path*',
    '/login',
    '/login/:path*',
    '/methode',
    '/methode/:path*',
    '/mylands',
    '/mylands/:path*',
    '/plan',
    '/plan/:path*',
    '/products',
    '/products/:path*',
    '/profile',
    '/profile/:path*',
    '/reactivate',
    '/reactivate/:path*',
    '/register',
    '/register/:path*',
    '/reservations',
    '/reservations/:path*',
    '/reset-password',
    '/reset-password/:path*',
    '/settings',
    '/settings/:path*',
    '/verify-certificate',
    '/verify-certificate/:path*',
    '/verify-email',
    '/verify-email/:path*',
    '/welcome',
    '/welcome/:path*',
  ],
};
