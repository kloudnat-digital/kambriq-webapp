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
