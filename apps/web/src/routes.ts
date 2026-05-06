export const AUTH_ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY_EMAIL: '/verify-email',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  REACTIVATE: '/reactivate',
};

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
