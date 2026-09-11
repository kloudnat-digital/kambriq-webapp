import { NextResponse } from 'next/server';
import { auth } from './auth';
import {
  AUTH_ROUTES,
  getDefaultRoute,
  isPublic,
  matchGate,
  REDIRECT_WHEN_AUTHED,
  safeCallbackUrl,
} from './routes';

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const pathname = nextUrl.pathname;
  const isAuthenticated = !!session?.user;
  const hasSessionError = session?.error === 'RefreshTokenError';
  const roles = session?.user?.roles ?? [];

  // Refresh failed → redirect to login. NextAuth replaces the broken session on re-login.
  // Skip if already on a public route (including /login) to avoid redirect loops:
  // the session keeps its error flag until the user actually signs in again, so a
  // naive redirect would bounce /login → /login → /login.
  if (isAuthenticated && hasSessionError && !isPublic(pathname)) {
    const loginUrl = new URL(AUTH_ROUTES.LOGIN, nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', safeCallbackUrl(pathname));
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user (with valid session) on landing/auth pages → redirect to their role home
  if (isAuthenticated && !hasSessionError) {
    const shouldRedirect = REDIRECT_WHEN_AUTHED.some((p) =>
      p === '/' ? pathname === '/' : pathname.startsWith(p),
    );
    if (shouldRedirect) {
      return NextResponse.redirect(new URL(getDefaultRoute(roles), nextUrl.origin));
    }
  }

  if (!isAuthenticated && !isPublic(pathname)) {
    const loginUrl = new URL(AUTH_ROUTES.LOGIN, nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', safeCallbackUrl(pathname));
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated) {
    const gate = matchGate(pathname);
    if (gate && !gate.roles.some((r) => roles.includes(r))) {
      return NextResponse.redirect(new URL(getDefaultRoute(roles), nextUrl.origin));
    }
  }

  return NextResponse.next();
});

/**
 * P3 - the middleware runs on protected prefixes, and on nothing else.
 *
 * ---------------------------------------------------------------------------
 * What this replaced, and why the shape matters more than the list
 * ---------------------------------------------------------------------------
 * This used to be one **negative** pattern: everything except `api`, `_next`
 * and some static files. So the middleware ran on every URL the site does not
 * serve, found it was not in `PUBLIC_PATHS`, and redirected it to
 * `/login?callbackUrl=...`. Measured against the running app before the change:
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
 * ---------------------------------------------------------------------------
 * The literals are here, and the truth is in routes.ts
 * ---------------------------------------------------------------------------
 * Next.js requires this array to be statically analysable, so it cannot be
 * built from `PROTECTED_PREFIXES` at module scope. Two copies would drift, so
 * `middleware-matcher.spec.ts` asserts this list against that one **and**
 * against the route files on disk. A protected page whose prefix is missing
 * from here fails the suite rather than being served to anonymous visitors.
 *
 * Each prefix is listed twice because `:path*` is zero-or-more and the bare
 * path is the one that matters most: `/admin` and `/admin/:path*`.
 *
 * `/`, `/login` and `/register` are matched although they are public. They are
 * `REDIRECT_WHEN_AUTHED`: a signed-in user is sent from them to their role's
 * home, which is not authentication but does happen here. Dropping them would
 * leave signed-in users looking at the marketing page.
 */
export const config = {
  matcher: [
    // Public, but the middleware sends a signed-in user onward from them.
    '/',
    '/login',
    '/register',

    // Protected. Keep in step with PROTECTED_PREFIXES in routes.ts.
    '/account',
    '/account/:path*',
    '/admin',
    '/admin/:path*',
    '/agent',
    '/agent/:path*',
    '/client',
    '/client/:path*',
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
    '/mylands',
    '/mylands/:path*',
    '/profile',
    '/profile/:path*',
    '/reservations',
    '/reservations/:path*',
    '/settings',
    '/settings/:path*',
    '/welcome',
    '/welcome/:path*',
  ],
};
