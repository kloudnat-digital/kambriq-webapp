/**
 * The enums come from `./enums`, NOT from the generated Prisma client.
 *
 * They used to be re-exported from `../../prisma/kamnet-client/enums`, and that
 * broke the web image on `develop`: the generated tree is gitignored and built
 * by `postinstall`, which `docker/Dockerfile.web` skips with
 * `--ignore-scripts`. The web imports this file, so the import had to go.
 * `./enums.ts` carries the reasoning and
 * `kamnet-enums-mirror-the-schema.spec.ts` stops the hand copy drifting.
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
 * What earns a promotion.
 *
 * P9 (20 September 2026) removed `MANAGER_REFERRALS`. MANAGER is ten completed
 * sales and nothing else: recruiting no longer gates the tier. Referrals still
 * exist and still matter - they simply stop deciding what an agent is.
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
 * How far sponsorship reaches: the agent who sells, and their direct sponsor.
 *
 * P9, arbitrated 20 September 2026. A sale pays level 0 - the agent who made
 * it - and level 1, whoever recruited them, and nobody beyond. So the tree is
 * walked exactly one step, in both directions. It was 3 (`N1, N2, N3`) until
 * that decision, and no commission row beyond level 1 was ever written.
 *
 * This is NOT a display preference to be widened when a page looks sparse.
 * `getMyNetwork` walking down and `getMySponsorChain` walking up both read it,
 * so raising it changes who appears in an agent's network and reinstates a
 * scheme the business no longer operates. A deeper tree is a commercial
 * decision, not a constant nudge.
 */
export const KAMNET_MAX_SPONSORSHIP_DEPTH = 1 as const;
export const KAMNET_MAX_FULL_TREE_ROOTS = 50 as const; // Cap for full tree endpoint to prevent overload on large networks

// ----- Job Payloads ----- //
export interface SaleCompletedJobPayload {
  agentUserId: string;
  landId: string;
  reservationId: string;
}
