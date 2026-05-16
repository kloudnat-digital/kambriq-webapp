import { NextResponse } from 'next/server';
import { auth } from './auth';
import { AUTH_ROUTES, getDefaultRoute, isPublic, matchGate, REDIRECT_WHEN_AUTHED } from './routes';

// NextAuth v5 cookies to clear when session is invalid/corrupt
const SESSION_COOKIES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'authjs.csrf-token',
  '__Host-authjs.csrf-token',
  'authjs.callback-url',
  '__Secure-authjs.callback-url',
] as const;

const clearSessionCookies = (response: NextResponse) => {
  for (const name of SESSION_COOKIES) {
    response.cookies.delete(name);
  }
  return response;
};

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const pathname = nextUrl.pathname;
  const isAuthenticated = !!session?.user;
  const hasSessionError = session?.error === 'RefreshTokenError';
  const roles = session?.user?.roles ?? [];

  // Refresh failed or session corrupt → clear cookies and avoid redirect loop
  if (isAuthenticated && hasSessionError) {
    // Already on /login: render page without redirect (would loop otherwise)
    if (pathname === AUTH_ROUTES.LOGIN) {
      return clearSessionCookies(NextResponse.next());
    }
    const loginUrl = new URL(AUTH_ROUTES.LOGIN, nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return clearSessionCookies(NextResponse.redirect(loginUrl));
  }

  // Authenticated user (with valid session) on landing/auth pages → redirect to their role home
  if (isAuthenticated && !hasSessionError) {
    const shouldRedirect = REDIRECT_WHEN_AUTHED.some((p) =>
      p === '/' ? pathname === '/' : pathname.startsWith(p),
    );
    if (shouldRedirect) {
      const target = getDefaultRoute(roles);
      // Sanity: never redirect to an auth route (would loop)
      if (target !== AUTH_ROUTES.LOGIN && target !== AUTH_ROUTES.REGISTER) {
        return NextResponse.redirect(new URL(target, nextUrl.origin));
      }
      // Target is an auth route: render current page without redirect
      return NextResponse.next();
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
