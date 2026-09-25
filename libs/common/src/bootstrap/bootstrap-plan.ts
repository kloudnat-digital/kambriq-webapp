import { SUPER_ADMIN_ROLE } from '../types/role-hierarchy';

/**
 * Pure logic for resolving database operations during admin account bootstrapping.
 * Dependency-free to support execution from standalone scripts outside the NestJS runtime.
 */

/** Fields owned by the bootstrap process and reconciled with the parameter store. */
export type BootstrapIdentity = {
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  country: string;
};

/** Existing account structure read by the bootstrap process. */
export type ExistingAccount = {
  firstName: string;
  lastName: string;
  phone: string | null;
  profile: { city: string | null; country: string | null } | null;
  roleCodes: string[];
};

export type BootstrapPlan = {
  action: 'create' | 'update' | 'unchanged';
  /** Indicates if a `UserRole` row for the top role must be written. */
  grantRole: boolean;
  /** Names of differing fields. Excludes values to prevent logging sensitive data. */
  changedFields: string[];
};

/**
 * Generates a reconciliation plan between existing account state and the bootstrap identity.
 * Excludes user-managed state (`passwordHash`, `emailVerified`, `isActive`).
 */
export function planBootstrap(
  existing: ExistingAccount | null,
  identity: BootstrapIdentity,
): BootstrapPlan {
  if (!existing) {
    // Ensure consistent role assignment across create and update branches.
    return { action: 'create', grantRole: true, changedFields: [] };
  }

  const changedFields: string[] = [];
  if (existing.firstName !== identity.firstName) changedFields.push('firstName');
  if (existing.lastName !== identity.lastName) changedFields.push('lastName');
  if (existing.phone !== identity.phone) changedFields.push('phone');
  if (existing.profile?.city !== identity.city) changedFields.push('city');
  if (existing.profile?.country !== identity.country) changedFields.push('country');

  const grantRole = !existing.roleCodes.includes(SUPER_ADMIN_ROLE);
  if (grantRole) changedFields.push(`role:${SUPER_ADMIN_ROLE}`);

  return {
    action: changedFields.length === 0 ? 'unchanged' : 'update',
    grantRole,
    changedFields,
  };
}
