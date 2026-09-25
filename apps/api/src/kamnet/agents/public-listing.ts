import { isActive } from '../../kbs/certificates/current-certificate';

/**
 * Public directory entry for certified agents.
 * Exposes only verification-critical fields, explicitly stripping recruitment
 * and ranking metrics (`salesCount`, `tier`, `agentCode`, contact info).
 * Uses `kcaNumber` as the unique identifier rather than exposing internal UUIDs.
 */
export type PublicDirectoryEntry = {
  readonly firstName: string;
  readonly lastName: string;
  readonly city: string | null;
  readonly country: string | null;
  readonly avatarUrl: string | null;
  readonly kcaNumber: string;
  /** The issue date of the certificate that stands, as an ISO string. */
  readonly certifiedSince: string;
};

/** The agent row, reduced to the fields that decide whether to publish. */
export type DirectoryAgent = {
  readonly userId: string;
  readonly publicListingConsentAt: Date | null;
  readonly suspendedAt: Date | null;
};

/** The core user and profile, which carry everything a reader actually sees. */
export type DirectoryUser = {
  readonly firstName: string;
  readonly lastName: string;
  readonly isActive: boolean;
  readonly deletedAt: Date | null;
  readonly profile: {
    readonly city: string | null;
    readonly country: string | null;
    readonly avatarUrl: string | null;
  } | null;
};

/**
 * Unreduced active certificate record.
 * Extracted fully to evaluate publication status locally without information loss.
 */
export type DirectoryCertificate = {
  /**
   * The `userId` of the candidate this certificate belongs to.
   *
   * Carried so the projection can PROVE the certificate is the agent's rather
   * than assume it. See the ownership check in `toPublicDirectoryEntry`.
   */
  readonly ownerUserId: string;
  readonly kcaNumber: string;
  readonly issueDate: Date;
  readonly validUntil: Date;
  readonly revokedAt: Date | null;
};

/**
 * Computes agent public directory visibility and payload.
 * Evaluates visibility on strict requirements: explicit consent, active core user,
 * active agent status, and a valid unexpired certificate.
 * Uses the certificate's `kcaNumber` as authoritative due to renewal divergence.
 * Assembles fields explicitly to prevent accidental data leakage via spread operators.
 */
export const toPublicDirectoryEntry = (
  agent: DirectoryAgent,
  user: DirectoryUser | null,
  certificate: DirectoryCertificate | null,
  now: Date = new Date(),
): PublicDirectoryEntry | null => {
  if (agent.publicListingConsentAt === null) return null;
  if (agent.suspendedAt !== null) return null;

  if (user === null) return null;
  if (!user.isActive) return null;
  if (user.deletedAt !== null) return null;

  if (certificate === null) return null;

  /**
   * The certificate has to be THIS agent's.
   *
   * The agent and the certificate arrive
   * as separate arguments, fetched separately, and the link between
   * `KamnetAgent.userId` and `KbsCandidate.userId` crosses two databases with
   * no foreign key to enforce it - convention, not constraint. Without this
   * line a mismatched pair published one person's KCA number under another
   * person's name, which `kamnet-public-directory.dbspec.ts` demonstrated
   * before the check existed.
   *
   * `toCertificateVerdict` guards the equivalent case with
   * `answer.kcaNumber !== requested`: never give a verdict about a certificate
   * other than the one that was asked about. This is that rule, one surface
   * over, and the caller's correctness is no longer load-bearing.
   */
  if (certificate.ownerUserId !== agent.userId) return null;

  if (!isActive(certificate, now)) return null;

  return {
    firstName: user.firstName,
    lastName: user.lastName,
    city: user.profile?.city ?? null,
    country: user.profile?.country ?? null,
    avatarUrl: user.profile?.avatarUrl ?? null,
    kcaNumber: certificate.kcaNumber,
    certifiedSince: certificate.issueDate.toISOString(),
  };
};

/**
 * Every key a public entry may carry. Exported so that a test can assert on
 * what is ABSENT rather than on what is present: a projection that accidentally
 * spread a whole record still carries all seven of these.
 */
export const PUBLIC_DIRECTORY_ENTRY_KEYS = [
  'firstName',
  'lastName',
  'city',
  'country',
  'avatarUrl',
  'kcaNumber',
  'certifiedSince',
] as const;
