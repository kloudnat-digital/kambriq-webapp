import type { AuthError } from 'next-auth';

/**
 * Extracts the raw cause message thrown inside authorize() from a next-auth AuthError.
 * next-auth v5 stores the original error in error.cause (or error.cause.err in some versions).
 */
export const getAuthErrorCause = (error: AuthError): string | undefined => {
  const cause = error.cause as unknown;
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === 'object' && 'err' in cause) {
    const inner = (cause as { err?: unknown }).err;
    if (inner instanceof Error) return inner.message;
  }
  return undefined;
};

/**
 * Parses a grace period reactivation signal from an error cause message.
 * Returns the signal if the message is valid JSON with code REACTIVATION_REQUIRED,
 * or null if it is a plain error message.
 */
export const parseReactivationSignal = (message: string): ReactivationSignal | null => {
  try {
    const parsed = JSON.parse(message) as ReactivationSignal;
    if (parsed?.code === 'REACTIVATION_REQUIRED' && parsed.userId) return parsed;
  } catch {
    /* not JSON - plain error message */
  }
  return null;
};
