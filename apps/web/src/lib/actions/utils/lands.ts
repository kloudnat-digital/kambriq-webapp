import { auth } from '@/auth';
import { isAdminLands } from '@/routes';

export const getUserRoles = async (): Promise<string[]> => {
  const session = await auth();
  return session?.user?.roles ?? [];
};

export const isAdminRole = isAdminLands;

export const buildQuery = (params: Record<string, unknown>): string => {
  const search = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return search ? `?${search}` : '';
};
