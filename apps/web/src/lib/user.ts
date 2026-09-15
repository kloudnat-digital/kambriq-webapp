import { RoleCode } from '@/lib/roles';

/**
 * Returns a translation key under `app.nav.role.*` for the highest-priority
 * role the user holds. Resolve via `useTranslations('app.nav')` or
 * `getTranslations('app.nav')` at the call site.
 */
export const getRoleLabelKey = (codes: string[]): string => {
  if (codes.includes('ROOT')) return 'role.root';
  if (codes.includes(RoleCode.ADMIN_GLOBAL)) return 'role.adminGlobal';
  if (codes.includes('OPS')) return 'role.ops';
  if (codes.includes(RoleCode.ADMIN_LANDS)) return 'role.adminLands';
  if (codes.includes(RoleCode.ADMIN_KBS)) return 'role.adminKbs';
  if (codes.includes(RoleCode.ADMIN_KAMNET)) return 'role.adminKamnet';
  if (codes.includes(RoleCode.AGENT)) return 'role.agent';
  if (codes.includes('PARTNER')) return 'role.partner';
  if (codes.includes(RoleCode.CLIENT)) return 'role.client';
  return 'role.user';
};

export const getInitials = (firstName?: string | null, lastName?: string | null): string => {
  const f = firstName?.[0] ?? '';
  const l = lastName?.[0] ?? '';
  return (f + l).toUpperCase() || '?';
};
