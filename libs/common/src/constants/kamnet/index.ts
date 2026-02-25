import {
  KamnetAgentTier,
  KamnetApplicationStatus,
  KamnetCommissionStatus,
  KamnetLeadSource,
  KamnetLeadStatus,
  KamnetReservationStatus,
} from '../../prisma/kamnet-client/enums';

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
  [KamnetLeadStatus.CONTACTED]: [
    KamnetLeadStatus.QUALIFIED,
    KamnetLeadStatus.LOST,
  ],
  [KamnetLeadStatus.QUALIFIED]: [
    KamnetLeadStatus.CONVERTED,
    KamnetLeadStatus.LOST,
  ],
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
