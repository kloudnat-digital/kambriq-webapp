/**
 * The parameter-to-identity logic of `bootstrap-admins.ts`, separated from it so
 * it can be tested without an AWS account and without a database. What this file
 * decides - whether the run may proceed at all - is the part that must not be
 * taken on trust, and it is pure: a map of parameter values in, a list of
 * identities or a thrown error out.
 */

export const IDENTITY_FIELDS = [
  'EMAIL',
  'FIRST_NAME',
  'LAST_NAME',
  'PHONE',
  'ADDRESS',
  'CITY',
  'COUNTRY',
] as const;

export type IdentityField = (typeof IDENTITY_FIELDS)[number];

export interface BootstrapAdmin extends Record<IdentityField, string> {
  slot: number;
}

export class BootstrapError extends Error {}

/**
 * `passwordHash` is a required column and these accounts are created without a
 * password, so the column carries a value that cannot be the hash of anything.
 * bcrypt compare returns false for a string it cannot parse, so login refuses
 * the account with an ordinary 401 rather than a 500. The leading '!' is the
 * convention /etc/shadow uses for a locked account.
 */
export const NO_PASSWORD = '!bootstrap-no-password-set';

export function collectAdmins(values: Map<string, string>): BootstrapAdmin[] {
  const rawCount = values.get('BOOTSTRAP_ADMIN_COUNT')?.trim();
  if (!rawCount) {
    throw new BootstrapError(
      'BOOTSTRAP_ADMIN_COUNT is not set. It says how many accounts this ' +
        'environment expects; without it a prefix holding no accounts at all is ' +
        'indistinguishable from a successful run.',
    );
  }

  const count = Number(rawCount);
  if (!Number.isInteger(count) || count < 1) {
    throw new BootstrapError(
      `BOOTSTRAP_ADMIN_COUNT is "${rawCount}", expected a positive integer.`,
    );
  }

  const missing: string[] = [];
  const admins: BootstrapAdmin[] = [];

  for (let slot = 1; slot <= count; slot++) {
    const admin = { slot } as BootstrapAdmin;
    for (const field of IDENTITY_FIELDS) {
      const key = `BOOTSTRAP_ADMIN_${slot}_${field}`;
      const value = values.get(key)?.trim();
      if (!value) missing.push(key);
      else admin[field] = value;
    }
    admins.push(admin);
  }

  // Every missing name at once. Reported one at a time, an operator fixes one
  // parameter, re-runs, and discovers the next - which is how a two-account
  // bootstrap turns into fourteen deployments.
  if (missing.length > 0) {
    throw new BootstrapError(
      `${missing.length} required parameter(s) missing or blank:\n` +
        missing.map((key) => `  - ${key}`).join('\n'),
    );
  }

  const duplicates = admins
    .map((admin) => admin.EMAIL.toLowerCase())
    .filter((email, index, all) => all.indexOf(email) !== index);
  if (duplicates.length > 0) {
    throw new BootstrapError(
      `Two slots carry the same email (${[...new Set(duplicates)].join(', ')}). ` +
        'Idempotency is keyed on the address, so the second slot would silently ' +
        'overwrite the first instead of creating an account.',
    );
  }

  return admins;
}
