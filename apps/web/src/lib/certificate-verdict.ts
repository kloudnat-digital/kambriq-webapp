/**
 * What `/verify-certificate` may tell the public about a KCA number.
 *
 * The page it replaces rendered a hard-coded certificate - 'Jean Dupont',
 * score 82, `valid: true` - for **any** number typed into the URL, anonymously.
 * It told strangers that certificates KAMBRIQ never issued were authentic.
 *
 * So the rule here is one-directional: **a positive verdict needs an explicit,
 * complete yes from the register, about the number that was asked.** Anything
 * else - an unknown number, an unexpected shape, a field missing, an answer
 * about a different number, an API that could not be reached - is never
 * `valid`. Where the answer is simply "we could not check", that is said as
 * such (`unavailable`), because "not recognised" would be a false statement
 * about a certificate that may be real.
 *
 * Pure, so it is tested without a network: `certificate-verdict.spec.ts`.
 */
export type CertificateVerdict =
  | { kind: 'valid'; kcaNumber: string; issueDate: string; validUntil: string }
  | { kind: 'expired'; kcaNumber: string; issueDate: string; validUntil: string }
  | { kind: 'revoked'; kcaNumber: string; issueDate: string; revokedAt: string | null }
  | { kind: 'unknown' }
  | { kind: 'unavailable' };

const isDate = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

/**
 * Maps the body of `GET /kbs/public/verify/:kcaNumber` to a verdict.
 *
 * `requested` is the number the visitor asked about. The register answers with
 * the number it found, and a verdict is only given when the two are the same.
 */
export const toCertificateVerdict = (requested: string, body: unknown): CertificateVerdict => {
  if (typeof body !== 'object' || body === null) return { kind: 'unavailable' };
  const answer = body as Record<string, unknown>;

  if (answer.status === 'UNKNOWN' && answer.valid === false) return { kind: 'unknown' };

  // Every verdict below describes a certificate the register holds, so it must
  // be the one that was asked about and it must carry its dates.
  if (answer.kcaNumber !== requested) return { kind: 'unavailable' };
  if (!isDate(answer.issueDate) || !isDate(answer.validUntil)) return { kind: 'unavailable' };
  const { issueDate, validUntil } = answer;

  if (answer.status === 'REVOKED' && answer.revoked === true && answer.valid === false) {
    return {
      kind: 'revoked',
      kcaNumber: requested,
      issueDate,
      revokedAt: isDate(answer.revokedAt) ? answer.revokedAt : null,
    };
  }

  if (answer.status === 'EXPIRED' && answer.isExpired === true && answer.valid === false) {
    return { kind: 'expired', kcaNumber: requested, issueDate, validUntil };
  }

  // The only door to a positive verdict, and every field has to agree.
  if (
    answer.status === 'VALID' &&
    answer.valid === true &&
    answer.revoked === false &&
    answer.isExpired === false
  ) {
    return { kind: 'valid', kcaNumber: requested, issueDate, validUntil };
  }

  return { kind: 'unavailable' };
};
