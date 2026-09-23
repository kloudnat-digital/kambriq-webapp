import { SUPER_ADMIN_ROLE } from '../types/role-hierarchy';

/**
 * Provides pure logic for determining the necessary database operations
 * during the bootstrap process for admin accounts.
 *
 * This module is dependency-free to allow execution from standalone scripts
 * outside the NestJS runtime.
 */

/** Fields the bootstrap owns and will reconcile with the parameter store. */
export type BootstrapIdentity = {
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  country: string;
};

/** The shape the bootstrap reads back for an account that already exists. */
export type ExistingAccount = {
  firstName: string;
  lastName: string;
  phone: string | null;
  profile: { city: string | null; country: string | null } | null;
  roleCodes: string[];
};

export type BootstrapPlan = {
  action: 'create' | 'update' | 'unchanged';
  /** True when a `UserRole` row for the top role has to be written. */
  grantRole: boolean;
  /** Names of the fields that differ, for the log line. Never their values. */
  changedFields: string[];
};

/**
 * Generates a plan to reconcile the existing account state with the provided bootstrap identity.
 * Note: Fields such as `passwordHash`, `emailVerified`, and `isActive` are excluded
 * from the reconciliation process to preserve user-managed state.
 */
export function planBootstrap(
  existing: ExistingAccount | null,
  identity: BootstrapIdentity,
): BootstrapPlan {
  if (!existing) {
    // The role is assigned on create. It is also assigned on update below - the
    // two branches must not disagree about it, which is the whole point of
    // deciding it in one place.
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
