/**
 * Exports manually synchronized Kamnet enums.
 * These are maintained here rather than importing from the Prisma generated client
 * to ensure compatibility with web bundles that may not run Prisma generation.
 */
import {
  KamnetAgentTier,
  KamnetApplicationStatus,
  KamnetCommissionStatus,
  KamnetLeadSource,
  KamnetLeadStatus,
  KamnetReservationStatus,
} from './enums';

export {
  KamnetAgentTier,
  KamnetApplicationStatus,
  KamnetCommissionStatus,
  KamnetLeadSource,
  KamnetLeadStatus,
  KamnetReservationStatus,
};

/**
 * Defines the sales thresholds required for agent promotions.
 */
export const KAMNET_PROMOTION_THRESHOLDS = {
  CONFIRMED_SALES: 5,
  MANAGER_SALES: 10,
} as const;

export const KAMNET_VALID_COMMISSION_TRANSITIONS: Record<string, string[]> = {
  [KamnetCommissionStatus.PENDING]: [KamnetCommissionStatus.VALIDATED],
  [KamnetCommissionStatus.VALIDATED]: [KamnetCommissionStatus.PAID],
  [KamnetCommissionStatus.PAID]: [],
} as const;

export const KAMNET_VALID_LEAD_TRANSITIONS: Record<string, string[]> = {
  [KamnetLeadStatus.NEW]: [KamnetLeadStatus.CONTACTED, KamnetLeadStatus.LOST],
  [KamnetLeadStatus.CONTACTED]: [KamnetLeadStatus.QUALIFIED, KamnetLeadStatus.LOST],
  [KamnetLeadStatus.QUALIFIED]: [KamnetLeadStatus.CONVERTED, KamnetLeadStatus.LOST],
  [KamnetLeadStatus.CONVERTED]: [],
  [KamnetLeadStatus.LOST]: [KamnetLeadStatus.CONTACTED],
};

// ----- Sponsorship Tree Depth ----- //
/**
 * Maximum traversal depth for sponsorship calculations.
 * Determines how many levels up/down the hierarchy commissions and network visibility extend.
 */
export const KAMNET_MAX_SPONSORSHIP_DEPTH = 1 as const;
export const KAMNET_MAX_FULL_TREE_ROOTS = 50 as const; // Cap for full tree endpoint to prevent overload on large networks

/**
 * I32 - how many levels of their own network an agent may read, by tier. The
 * API applies it to the caller's stored tier; a page never decides it. Bounded
 * by `KAMNET_MAX_SPONSORSHIP_DEPTH` whatever this table says, and a tier it does
 * not name reads one level.
 */
export const KAMNET_NETWORK_DEPTH_BY_TIER: Readonly<Record<string, number>> = {
  JUNIOR: 1,
  CONFIRMED: 1,
  MANAGER: KAMNET_MAX_SPONSORSHIP_DEPTH,
};

/**
 * P22 - the most entries the public directory returns in one answer. Bounded the
 * way the full tree is (`KAMNET_MAX_FULL_TREE_ROOTS`): a named cap, and a
 * warning in the log when it is reached, never a silent cut. Ten agents today;
 * the cap is ten times that, so reaching it is news, not noise.
 */
export const KAMNET_MAX_PUBLIC_DIRECTORY_ENTRIES = 100 as const;

// ----- Job Payloads ----- //
export interface SaleCompletedJobPayload {
  agentUserId: string;
  landId: string;
  reservationId: string;
}
