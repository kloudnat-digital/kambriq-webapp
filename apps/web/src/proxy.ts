import NextAuth from 'next-auth';
import authConfig from './auth.config';
import { AUTH_ROUTES } from './routes';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

// Paths accessible without authentication
const PUBLIC_PATHS = [
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
  '/partners',
  '/coming-soon',
  '/help',
  '/knowledge-base',
  '/legal',
  '/products',
  '/verify-certificate',
];

// Paths where authenticated users should be redirected to their role home
// '/' uses exact match; others use startsWith
const REDIRECT_WHEN_AUTHED = ['/', '/login', '/register'];

const LOCALES = ['fr', 'en'];

const stripLocale = (pathname: string) => {
  const segments = pathname.split('/');
  if (segments.length > 1 && LOCALES.includes(segments[1])) {
    return '/' + segments.slice(2).join('/') || '/';
  }
  return pathname;
};

const isPublic = (pathname: string) => {
  const bare = stripLocale(pathname);
  return PUBLIC_PATHS.some((p) => bare === p || bare.startsWith(p + '/'));
};

const getDefaultRoute = (roleCodes: string[]): string => {
  if (roleCodes.includes('CLIENT')) return '/mylands';
  if (
    roleCodes.includes('AGENT') ||
    roleCodes.includes('ADMIN_LANDS') ||
    roleCodes.includes('ADMIN_GLOBAL')
  )
    return '/lands';
  if (roleCodes.includes('ADMIN_KBS')) return '/kbs/admin';
  if (roleCodes.includes('ADMIN_KAMNET')) return '/kamnet/admin/agents';
  return '/mylands';
};

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const pathname = nextUrl.pathname;
  const isAuthenticated = !!session?.user;

  // Authenticated user on landing/auth pages → redirect to their role home
  if (isAuthenticated) {
    const bare = stripLocale(pathname);
    const shouldRedirect = REDIRECT_WHEN_AUTHED.some((p) =>
      p === '/' ? bare === '/' : bare.startsWith(p),
    );
    if (shouldRedirect) {
      const rawRoles =
        (session.user as unknown as { roles?: Array<{ code: string } | string> })?.roles ?? [];
      const roles = rawRoles.map((r) => (typeof r === 'string' ? r : r.code));
      return NextResponse.redirect(new URL(getDefaultRoute(roles), nextUrl.origin));
    }
  }

  // Unauthenticated user on a protected route → redirect to login
  if (!isAuthenticated && !isPublic(pathname)) {
    const loginUrl = new URL(AUTH_ROUTES.LOGIN, nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|health|_next/static|_next/image|favicon.ico|assets).*)'],
};
