/**
 * Redaction helpers for log payloads.
 *
 * Until now every logger metadata object was silently discarded by nestjs-pino,
 * so these payloads never reached CloudWatch. Enabling them makes months of
 * previously-invisible fields durable, which is a privacy change as much as an
 * observability one. Anything identifying a person directly is masked or
 * reduced to a key list before it is written.
 */

/** `alice.martin@kambriq.com` -> `al***@kambriq.com`. Enough to correlate, not to contact. */
export const maskEmail = (email: string | null | undefined): string => {
  if (!email) return '<none>';
  const at = email.indexOf('@');
  if (at <= 0) return '<redacted>';
  const local = email.slice(0, at);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***${email.slice(at)}`;
};

/**
 * Log which fields a DTO changed, never their values. A full DTO can carry an
 * email, a phone number, a name or a role change.
 */
export const changedKeys = (dto: object | null | undefined): string[] =>
  dto ? Object.keys(dto) : [];
