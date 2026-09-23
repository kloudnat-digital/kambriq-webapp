import { randomBytes } from 'node:crypto';
import { RESET_TOKEN_EXPIRY_HOURS, VerificationTokenType } from '../constants/core';
import { EMAIL_TOKEN_EXPIRY_HOURS } from '../constants/email';

/**
 * Defines a structurally typed store interface for verification tokens.
 * This abstraction allows token issuance to be reused across different execution
 * contexts (e.g., the main API runtime and standalone bootstrap scripts) without
 * coupling to a specific Prisma client instance.
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
 * Invalidates all existing unused tokens of the specified type for the given user,
 * then issues and returns a new verification token.
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
