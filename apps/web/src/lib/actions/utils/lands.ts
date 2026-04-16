import { auth } from '@/auth';

export const getUserRoles = async (): Promise<string[]> => {
  const session = await auth();
  return (session?.user as { roles?: string[] })?.roles ?? [];
};

export const isAdminRole = (roles: string[]) =>
  roles.includes('ADMIN_LANDS') || roles.includes('ADMIN_GLOBAL');

export const buildQuery = (params: Record<string, unknown>): string => {
  const search = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return search ? `?${search}` : '';
};
