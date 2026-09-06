import { randomBytes } from 'node:crypto';
import { RESET_TOKEN_EXPIRY_HOURS, VerificationTokenType } from '../constants/core';
import { EMAIL_TOKEN_EXPIRY_HOURS } from '../constants/email';

/**
 * Issuing a verification token, in one place, because two places would drift.
 *
 * This was a private method on `AuthService`. `prisma/bootstrap-admins.ts` needs
 * the same thing and cannot import it: the production image carries
 * `dist/apps/api` bundled, not `apps/api/src` as source, so nothing under
 * `apps/api/src` is reachable from a script that runs under `tsx`.
 *
 * The alternative was to re-implement it in the script. That is the shape this
 * project keeps meeting from the other side - **two ways of doing one thing, and
 * a fix applied to one of them.** The day somebody starts hashing the token at
 * rest, or shortens the expiry, or stops invalidating the previous one, only one
 * caller would learn about it, and the other would keep working until it
 * silently did not.
 *
 * The store is typed structurally rather than as a Prisma client, so this module
 * imports nothing from `@prisma/client` and can be handed the core client, a
 * transaction client, or a fake.
 */
export type VerificationTokenStore = {
  verificationToken: {
    updateMany(args: {
      where: { userId: string; type: string; usedAt: null };
      data: { usedAt: Date };
    }): Promise<unknown>;
    create(args: {
      data: { userId: string; token: string; type: string; expiresAt: Date };
    }): Promise<unknown>;
  };
};

/** Hours a token of this type stays valid. */
export const verificationTokenExpiryHours = (type: VerificationTokenType): number =>
  type === VerificationTokenType.PASSWORD_RESET
    ? RESET_TOKEN_EXPIRY_HOURS
    : EMAIL_TOKEN_EXPIRY_HOURS;

/**
 * Invalidates every unused token of the same type, then issues one.
 *
 * The invalidation is not tidiness. Two live tokens of one type means a link a
 * person was told to ignore still works, and it is the reason a mis-aimed test
 * run could not leave a usable second token behind.
 */
export async function issueVerificationToken(
  store: VerificationTokenStore,
  userId: string,
  type: VerificationTokenType,
): Promise<string> {
  await store.verificationToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomBytes(32).toString('hex');

  await store.verificationToken.create({
    data: {
      userId,
      token,
      type,
      expiresAt: new Date(Date.now() + verificationTokenExpiryHours(type) * 3_600_000),
    },
  });

  return token;
}
