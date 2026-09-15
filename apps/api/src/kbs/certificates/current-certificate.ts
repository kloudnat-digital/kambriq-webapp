/**
 * I15 renewal - a candidate's certificates, newest first; the current one is
 * the first.
 *
 * A candidate held one certificate for life (`candidateId` was unique). A
 * renewal now adds a certificate with its own number and dates, and the old one
 * stays in the register, verifiable as expired or revoked. Every reader that
 * wants "the" certificate takes the newest, ordered here once so that no two
 * readers can disagree about which one is current.
 */
export const NEWEST_FIRST = {
  orderBy: [{ issueDate: 'desc' as const }, { createdAt: 'desc' as const }],
};

/** A certificate stands when it is neither revoked nor expired. */
export const isActive = (
  certificate: { revokedAt: Date | null; validUntil: Date },
  now: Date = new Date(),
): boolean => !certificate.revokedAt && certificate.validUntil > now;
