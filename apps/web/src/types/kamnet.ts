import type {
  KamnetAgentTier,
  KamnetLeadSource,
  KamnetLeadStatus,
} from '@kambriq/common/constants/kamnet';

/**
 * Response types for `GET /kamnet/*` endpoints.
 * These types are derived from the service layer rather than Prisma models to account
 * for additional enriched fields (e.g., core user details and computed metrics).
 */

export type KamnetTier = KamnetAgentTier;
export type LeadSource = KamnetLeadSource;
export type LeadStatus = KamnetLeadStatus;

/** Core user details attached to each agent node. */
export interface NetworkUser {
  firstName: string | null;
  lastName: string | null;
  email: string;
  country: string | null;
  city: string | null;
}

/** Represents an agent within a sponsorship tree. */
export interface NetworkAgent {
  id: string;
  agentCode: string;
  tier: KamnetTier;
  salesCount: number;
  createdAt: string;
  user: NetworkUser;
}

/**
 * Represents a recursive node in the sponsorship tree.
 * The depth is structurally unbounded but practically limited by server-side business rules.
 */
export interface NetworkNode {
  agent: NetworkAgent;
  referrals: NetworkNode[];
}

/** Represents the upward sponsorship chain for an agent. */
export interface SponsorChain {
  agent: { id: string; agentCode: string };
  chain: Array<{ id: string; agentCode: string; level: number; name?: string }>;
}

/** Flattened representation of the current agent's profile and user details. */
export interface MyAgentProfile {
  id: string;
  userId: string;
  kcaNumber: string;
  agentCode: string;
  bio: string | null;
  tier: KamnetTier;
  salesCount: number;
  sponsorId: string | null;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    email: string;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    address: string | null;
    avatarUrl: string | null;
    country: string | null;
    city: string | null;
  };
}

/** Public profile details of a Kamnet agent. */
export interface PublicAgentProfile {
  id: string;
  bio: string | null;
  tier: KamnetTier;
  agentCode: string;
  salesCount: number;
  referralCount: number;
}

/** Represents a prospective client (lead). */
export interface Lead {
  id: string;
  agentId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  source: LeadSource | null;
  notes: string | null;
  status: LeadStatus;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadInput {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  source: LeadSource;
  notes: string;
}

export interface UpdateLeadInput {
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  source?: LeadSource;
  notes?: string;
  status?: LeadStatus;
}

export interface UpdateAgentProfileInput {
  bio?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  language?: string;
  avatarUrl?: string;
  address?: string;
  city?: string;
  country?: string;
}

/** Represents an agent commission. The `amount` is in XAF. */
export interface Commission {
  id: string;
  agentId: string;
  landId: string;
  reservationId: string;
  /**
   * Represents the commission level:
   * 0 = The agent who finalized the sale.
   * 1 = The direct sponsor of the agent.
   */
  level: number;
  pv: number;
  tpc: number;
  amount: number;
  status: 'PENDING' | 'VALIDATED' | 'PAID';
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionSummary {
  pending: { count: number; totalAmount: number };
  validated: { count: number; totalAmount: number };
  paid: { count: number; totalAmount: number };
}

export interface LeadFilters {
  status?: LeadStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CommissionFilters {
  status?: 'PENDING' | 'VALIDATED' | 'PAID';
  page?: number;
  limit?: number;
}
