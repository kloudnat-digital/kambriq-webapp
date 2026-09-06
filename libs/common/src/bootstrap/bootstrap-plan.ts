import { SUPER_ADMIN_ROLE } from '../types/role-hierarchy';

/**
 * What the bootstrap decides to do about one account, separated from doing it.
 *
 * It lives here rather than inside `prisma/bootstrap-admins.ts` for one reason:
 * **nothing tested the branch that assigns the role.** Journey 5 grants
 * `ADMIN_GLOBAL` to itself before activating, so it proves a passwordless
 * account can be activated and never that the bootstrap assigns anything. The
 * mechanism that was proved was not the mechanism that ran, and the suite was
 * green throughout.
 *
 * The write itself needs a database and the deployed image. The **decision** -
 * create or update, grant or leave alone - is the part that was hypothesised to
 * be wrong ("the update branch refreshed the name and never touched the roles,
 * like the seed's `update: {}`"), and it is pure. So it is pulled out, and
 * `bootstrap-plan.spec.ts` covers every branch including that one.
 *
 * This module is dependency-free on purpose: `prisma/bootstrap-admins.ts` runs
 * from source under `tsx` outside the Nest runtime.
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
 * `passwordHash`, `emailVerified` and `isActive` never appear here.
 *
 * They belong to the account holder from the moment they first use their reset
 * link. A bootstrap that reconciled them would undo a real person's password on
 * the next deployment.
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
