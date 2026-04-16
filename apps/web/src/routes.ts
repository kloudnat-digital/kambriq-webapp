export const AUTH_ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY_EMAIL: '/verify-email',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  REACTIVATE: '/reactivate',
};

export const PROTECTED_ROUTES = {
  DASHBOARD: '/dashboard',
};

export const APP_ROUTES = {
  HOME: '/',
  LANDS: '/lands',
  LANDS_NEW: '/lands/new',
  LAND_DETAIL: (id: string) => `/lands/${id}`,
  LAND_RESERVE: (id: string) => `/lands/${id}/reserve`,
  MY_LANDS: '/mylands',
  PURCHASE_DETAIL: (id: string) => `/mylands/purchase/${id}`,
  RESERVATIONS: '/reservations',
  RESERVATION_DETAIL: (id: string) => `/reservations/${id}`,
  INVITE: '/invite',
};

export const PUBLIC_ROUTES = {};

/** Returns the home route for a given set of role codes */
export const getDefaultRoute = (roleCodes: string[]): string => {
  if (roleCodes.includes('CLIENT')) return APP_ROUTES.MY_LANDS;
  if (
    roleCodes.includes('AGENT') ||
    roleCodes.includes('ADMIN_LANDS') ||
    roleCodes.includes('ADMIN_GLOBAL')
  ) {
    return APP_ROUTES.LANDS;
  }
  return APP_ROUTES.HOME;
};
