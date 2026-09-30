import { UnauthorizedException } from '@nestjs/common';

/** The account fields every session is judged on. */
export const SESSION_STANDING_SELECT = {
  isActive: true,
  deactivatedBy: true,
  deletedAt: true,
  lockedUntil: true,
  emailVerified: true,
} as const;

export type SessionStanding = {
  isActive: boolean;
  deactivatedBy: string | null;
  deletedAt: Date | null;
  lockedUntil: Date | null;
  emailVerified: boolean;
};

/**
 * C40 - the one rule deciding whether an account may hold a session.
 *
 * Called where an access token is accepted (`JwtStrategy`) and where a new pair
 * is minted (`refreshTokens`). A door that grants or renews a session calls this
 * function; it never carries its own copy of the checks, because copies diverge
 * (C39: sign-in refused an unverified address while the strategy did not).
 *
 * Sign-in is not a caller: it answers before the password and redirects a
 * grace-period holder to reactivation, an ordering this function does not model.
 */
export const assertHoldsSession = (user: SessionStanding, t: (key: string) => string): void => {
  if (!user.isActive && user.deactivatedBy) {
    throw new UnauthorizedException(t('auth.jwt.accountSuspended'));
  }
  if (!user.isActive && user.deletedAt) {
    throw new UnauthorizedException(t('auth.jwt.accountDeleted'));
  }
  if (!user.isActive) {
    throw new UnauthorizedException(t('auth.jwt.accountInactive'));
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new UnauthorizedException(t('auth.jwt.accountLocked'));
  }
  // Registration issues tokens before the address is proven. Tagged like the
  // sign-in refusal so a client can offer a new link.
  if (!user.emailVerified) {
    throw new UnauthorizedException({
      message: t('auth.jwt.emailNotVerified'),
      error: 'EMAIL_NOT_VERIFIED',
    });
  }
};
