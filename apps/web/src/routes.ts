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
// /reactivate is listed and has no page at all, which is a genuine bug but not
// a bug in this list: lib/actions/auth.ts redirects there when the API answers
// REACTIVATION_REQUIRED, so a user in the soft-delete grace period is sent to a
// 404 today. The entry is correct and must stay; the missing page is the fix.
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

export const ROLE_GATES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: '/admin/kbs', roles: ['ADMIN_KBS', 'ADMIN_GLOBAL'] },
  { prefix: '/admin/kamnet', roles: ['ADMIN_KAMNET', 'ADMIN_GLOBAL'] },
  { prefix: '/admin/lands', roles: ['ADMIN_LANDS', 'ADMIN_GLOBAL'] },
  { prefix: '/admin/reservations', roles: ['ADMIN_LANDS', 'ADMIN_GLOBAL'] },
  { prefix: '/admin/verify', roles: ['ADMIN_LANDS', 'ADMIN_GLOBAL'] },
  { prefix: '/agent', roles: ['AGENT', 'ADMIN_GLOBAL'] },
  { prefix: '/land', roles: ['AGENT', 'ADMIN_GLOBAL'] },
];

export const ROLE_DEFAULTS: Record<string, string> = {
  CLIENT: '/mylands',
  AGENT: '/lands',
  ADMIN_LANDS: '/lands',
  ADMIN_GLOBAL: '/lands',
  ADMIN_KBS: '/admin/kbs',
  ADMIN_KAMNET: '/admin/kamnet',
};

export const ADMIN_LANDS_ROLES: readonly string[] = ['ADMIN_LANDS', 'ADMIN_GLOBAL'];

export const isAdminLands = (roles: string[]) => roles.some((r) => ADMIN_LANDS_ROLES.includes(r));

export const canManageReservations = (roles: string[]) =>
  isAdminLands(roles) || roles.includes('AGENT');

export const isPublic = (pathname: string) => {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
};

export const matchGate = (pathname: string) => {
  return ROLE_GATES.find((g) => pathname === g.prefix || pathname.startsWith(g.prefix + '/'));
};

export const getDefaultRoute = (roles: string[]) => {
  for (const r of roles) if (ROLE_DEFAULTS[r]) return ROLE_DEFAULTS[r];
  return '/mylands';
};
