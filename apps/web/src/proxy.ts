import { NextResponse } from 'next/server';
import { auth } from './auth';
import { AUTH_ROUTES, getDefaultRoute, isPublic, matchGate, REDIRECT_WHEN_AUTHED } from './routes';

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
    loginUrl.searchParams.set('callbackUrl', pathname);
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
    loginUrl.searchParams.set('callbackUrl', pathname);
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

export const config = {
  matcher: [
    '/((?!api|health|_next/static|_next/image|favicon.ico|apple-touch-icon.png|og-image|twitter-card|site.webmanifest|assets|icons).*)',
  ],
};
