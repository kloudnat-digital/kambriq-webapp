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

export const KAMNET_PROMOTION_THRESHOLDS = {
  CONFIRMED_SALES: 5,
  MANAGER_SALES: 10,
  MANAGER_REFERRALS: 10,
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
export const KAMNET_MAX_SPONSORSHIP_DEPTH = 3 as const; // N1, N2, N3
export const KAMNET_MAX_FULL_TREE_ROOTS = 50 as const; // Cap for full tree endpoint to prevent overload on large networks

// ----- Job Payloads ----- //
export interface SaleCompletedJobPayload {
  agentUserId: string;
  landId: string;
  reservationId: string;
}
