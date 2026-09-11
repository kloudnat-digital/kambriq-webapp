export const GRACE_PERIOD_DAYS = 30 as const;
export const MAX_LOGIN_ATTEMPTS = 5 as const;
export const LOCK_DURATION_MINUTES = 15 as const;
export const RESET_TOKEN_EXPIRY_HOURS = 1 as const;
export const EMAIL_CHANGE_TOKEN_EXPIRY_HOURS = 24 as const;

export enum VerificationTokenType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  ACCOUNT_REACTIVATION = 'ACCOUNT_REACTIVATION',
  EMAIL_CHANGE = 'EMAIL_CHANGE',
}

export enum IdVerificationStatus {
  NONE = 'none',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

/**
 * L1 - what an inbound contact request is about.
 *
 * Mirrors `ContactSubject` in `prisma/core/schema.prisma`. Written here rather
 * than imported from the generated client for the reason the payment enums are:
 * the **web** imports this file, and the generated Prisma client cannot cross
 * into a browser bundle. `contact-subjects.spec.ts` compares the two lists
 * member by member, so an enum extended in one place and not the other fails.
 *
 * The screen labels are not derived from these codes - `'KBS'.toLowerCase()` is
 * not "Formation KBS". They live in the web i18n catalogues, keyed by the
 * lower-cased code.
 */
export enum ContactSubject {
  LANDS = 'LANDS',
  VERIFY = 'VERIFY',
  KAMNET = 'KAMNET',
  KBS = 'KBS',
  PARTNERSHIP = 'PARTNERSHIP',
  OTHER = 'OTHER',
}

/** Where a contact request has got to in the back office. */
export enum ContactRequestStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  CLOSED = 'CLOSED',
}

/** The order the six are offered in, so the form and any listing agree. */
export const CONTACT_SUBJECTS: readonly ContactSubject[] = [
  ContactSubject.LANDS,
  ContactSubject.VERIFY,
  ContactSubject.KAMNET,
  ContactSubject.KBS,
  ContactSubject.PARTNERSHIP,
  ContactSubject.OTHER,
];
