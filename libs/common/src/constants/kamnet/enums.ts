/**
 * Manually defined enums matching the Kamnet Prisma schema.
 * Extracted from the generated Prisma client to allow usage in web environments
 * where Prisma generation is excluded. Ensured consistent with the database schema
 * via unit tests.
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
