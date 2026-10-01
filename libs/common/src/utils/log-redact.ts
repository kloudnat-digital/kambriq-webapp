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
 * Masks every email address found in free text: a provider's error message, a
 * composed sentence. For text a log line did not build itself, where the address
 * cannot be masked at the call site.
 */
export const redactEmails = (text: string): string =>
  text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (address) => maskEmail(address));

/**
 * Extracts the keys of a modified DTO to log structural changes
 * without exposing potentially sensitive field values.
 */
export const changedKeys = (dto: object | null | undefined): string[] =>
  dto ? Object.keys(dto) : [];
