import { isActive } from '../../kbs/certificates/current-certificate';

/**
 * P11 - one entry in the public directory of certified agents.
 *
 * ---------------------------------------------------------------------------
 * Seven fields, and the list is the contract
 * ---------------------------------------------------------------------------
 * A buyer has nothing to look at before committing, so the whole burden of
 * proof falls on the agent - who is today an unknown. This makes the agent
 * visible and checkable, and nothing more than that.
 *
 * What it deliberately does NOT carry: `salesCount`, `referralCount`,
 * `sponsor`, `tier`, `agentCode`, email, phone, address, `bio`. The first three
 * are the recruitment and ranking metrics the P9 arbitrage removed from the
 * public site; `tier` is a ranking by another name. `KamnetAgentsService`
 * already has a projection that returns all of them - `findById`, typed on the
 * web as `PublicAgentProfile`, which is a misnomer: it is the authenticated
 * agent-to-agent view behind `@Roles(RoleCode.AGENT)`. Reusing it here would
 * publish exactly what P9 took down, which is why this type is separate and
 * named for what it is.
 *
 * There is no identifier in the entry. `kcaNumber` is unique, already public,
 * and is what a reader checks against the verifier, so it is also the key a
 * list renders on. An `id` would be a second handle on a person for no reader's
 * benefit.
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
 * The newest certificate, unreduced.
 *
 * Deliberately not `findActiveCertificate`'s `{ kcaNumber, validUntil } | null`:
 * that method answers "is this person certified" by collapsing revoked, expired
 * and absent into one null. The decision to publish is taken here, in one
 * place, against `isActive` - so the facts arrive whole.
 */
export type DirectoryCertificate = {
  readonly kcaNumber: string;
  readonly issueDate: Date;
  readonly validUntil: Date;
  readonly revokedAt: Date | null;
};

/**
 * Whether this agent appears in the public directory, and as what.
 *
 * ---------------------------------------------------------------------------
 * One-directional, like the certificate verifier
 * ---------------------------------------------------------------------------
 * `toCertificateVerdict` needs an explicit, complete yes from the register
 * before it says "valid". The same shape applies here for the same reason: this
 * publishes a real person's name, face and city to strangers, so every
 * condition has to be met and anything missing or unexpected is `null`.
 *
 * The five refusals, and why each one:
 *
 *   - **no consent** (`publicListingConsentAt` null). Nothing in the model
 *     recorded consent before P11, so the column is null for every row that
 *     already existed: nobody becomes published because a migration ran.
 *   - **suspended**. A suspended agent is not accompanying anybody, and the
 *     directory is a statement that they are.
 *   - **no certificate, revoked, or expired**. A directory that lists somebody
 *     whose certificate lapsed is worse than no directory, because it launders
 *     a lapsed credential. Read through `isActive`, the same predicate the
 *     certificate readers use, rather than re-deriving revoked-or-expired here.
 *   - **no core user, deactivated, or soft-deleted**. Beyond the brief's three
 *     exclusions and reported as such: publishing the name of somebody who
 *     deleted their account is the one failure nobody would forgive, and the
 *     row that would do it is exactly the row whose name we still hold.
 *
 * ---------------------------------------------------------------------------
 * The number published is the certificate's, not the agent's
 * ---------------------------------------------------------------------------
 * `KamnetAgent.kcaNumber` is a copy taken when the application was approved.
 * Since I15, a renewal issues a NEW certificate with its own number, and
 * nothing updates that copy - so the two legitimately diverge and the agent's
 * is the stale one. The certificate is the truth (see
 * `findActiveCertificate`'s docstring), so its number is what a reader is
 * given to check. Refusing to publish on a mismatch would delist every agent
 * who ever renewed.
 *
 * ---------------------------------------------------------------------------
 * Built field by field, never spread
 * ---------------------------------------------------------------------------
 * The return is assembled one property at a time. A projection written as
 * `{ ...agent, ...user }` carries whatever those rows happen to hold today and
 * silently grows the day a column is added - which is how `salesCount` would
 * reach a public page without anybody deciding it should.
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
