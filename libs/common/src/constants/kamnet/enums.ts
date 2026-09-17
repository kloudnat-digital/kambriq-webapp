/**
 * The KAMNET enums, hand-written so the web can import them.
 *
 * ---------------------------------------------------------------------------
 * Why these are not imported from the generated Prisma client
 * ---------------------------------------------------------------------------
 * They were, until this file existed, and it broke `develop`.
 *
 * `constants/kamnet/index.ts` re-exported them from
 * `../../prisma/kamnet-client/enums`. That path is a GENERATED client: it is
 * gitignored (`.gitignore`: `libs/common/src/prisma/*`, zero tracked files) and
 * produced by `postinstall`. `docker/Dockerfile.web` installs with
 * `--ignore-scripts`, so `postinstall` never runs there, and it copies no
 * `prisma/` directory and issues no `prisma generate`. `Dockerfile.api` does
 * both, which is why the API image built and the web image did not:
 *
 *   ./libs/common/src/constants/kamnet/index.ts:1:1
 *   Module not found: Can't resolve '../../prisma/kamnet-client/enums'
 *
 * Every local gate passed - `typecheck:web`, `lint:web`, 300 unit tests, and
 * CI's `Quality` job - because the generated client exists in all of those
 * environments. The image is the one place it does not. **A green local run
 * says nothing about a tree the image does not carry.**
 *
 * ---------------------------------------------------------------------------
 * This is the established pattern here, not a workaround
 * ---------------------------------------------------------------------------
 * `ContactSubject` in `constants/core` says it in as many words: "Written here
 * rather than imported from the generated client for the reason the payment
 * enums are: the web imports this file, and the generated Prisma client cannot
 * cross into a browser bundle." `PaymentState` in `payments/payment-state.ts`
 * mirrors `prisma/lands/schema.prisma` the same way.
 *
 * The cost of a hand copy is drift, and drift is what a test is for:
 * `kamnet-enums-mirror-the-schema.spec.ts` parses each `enum X { ... }` block
 * out of `prisma/kamnet/schema.prisma` and compares it member by member, in
 * both directions, exactly as `contact-subjects.spec.ts` does for its three
 * copies. A member added to one side and not the other fails there.
 *
 * Declared as `const` objects with a companion type rather than `enum`, which
 * is what the generated client did, so every existing
 * `KamnetAgentTier.CONFIRMED` call site keeps compiling unchanged.
 */

/** Mirrors `enum KamnetAgentTier` in `prisma/kamnet/schema.prisma`. */
export const KamnetAgentTier = {
  JUNIOR: 'JUNIOR',
  CONFIRMED: 'CONFIRMED',
  MANAGER: 'MANAGER',
} as const;
export type KamnetAgentTier = (typeof KamnetAgentTier)[keyof typeof KamnetAgentTier];

/** Mirrors `enum KamnetApplicationStatus` in `prisma/kamnet/schema.prisma`. */
export const KamnetApplicationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type KamnetApplicationStatus =
  (typeof KamnetApplicationStatus)[keyof typeof KamnetApplicationStatus];

/** Mirrors `enum KamnetCommissionStatus` in `prisma/kamnet/schema.prisma`. */
export const KamnetCommissionStatus = {
  PENDING: 'PENDING',
  VALIDATED: 'VALIDATED',
  PAID: 'PAID',
} as const;
export type KamnetCommissionStatus =
  (typeof KamnetCommissionStatus)[keyof typeof KamnetCommissionStatus];

/** Mirrors `enum KamnetLeadSource` in `prisma/kamnet/schema.prisma`. */
export const KamnetLeadSource = {
  SOCIAL_MEDIA: 'SOCIAL_MEDIA',
  REFERRAL: 'REFERRAL',
  EVENT: 'EVENT',
  OTHER: 'OTHER',
} as const;
export type KamnetLeadSource = (typeof KamnetLeadSource)[keyof typeof KamnetLeadSource];

/** Mirrors `enum KamnetLeadStatus` in `prisma/kamnet/schema.prisma`. */
export const KamnetLeadStatus = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  QUALIFIED: 'QUALIFIED',
  CONVERTED: 'CONVERTED',
  LOST: 'LOST',
} as const;
export type KamnetLeadStatus = (typeof KamnetLeadStatus)[keyof typeof KamnetLeadStatus];

/** Mirrors `enum KamnetReservationStatus` in `prisma/kamnet/schema.prisma`. */
export const KamnetReservationStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type KamnetReservationStatus =
  (typeof KamnetReservationStatus)[keyof typeof KamnetReservationStatus];
