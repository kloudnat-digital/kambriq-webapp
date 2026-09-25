/** Redacts sensitive PII from log payloads. */

/** Masks email addresses, retaining partial identifiers for correlation. */
export const maskEmail = (email: string | null | undefined): string => {
  if (!email) return '<none>';
  const at = email.indexOf('@');
  if (at <= 0) return '<redacted>';
  const local = email.slice(0, at);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***${email.slice(at)}`;
};

/**
 * Extracts the keys of a modified DTO to log structural changes
 * without exposing potentially sensitive field values.
 */
export const changedKeys = (dto: object | null | undefined): string[] =>
  dto ? Object.keys(dto) : [];
