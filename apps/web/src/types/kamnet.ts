import type {
  KamnetAgentTier,
  KamnetLeadSource,
  KamnetLeadStatus,
} from '@kambriq/common/constants/kamnet';

/**
 * The shapes `GET /kamnet/*` actually answers with.
 *
 * Typed from the services rather than from the Prisma models, because the two
 * differ: `network.service.ts` enriches every node with Core user fields, and
 * `agents.service.ts` adds a `referralCount` that exists on no table. A type
 * copied from the schema would typecheck and be wrong at runtime - the "type
 * that lies" defect this repository already paid for, where a declared `.data`
 * the runtime had stripped made `nx typecheck web` agree with a page that threw
 * on open.
 *
 * The enums are imported, never re-declared. A re-spelled union is the same
 * defect as a role code written as a bare string.
 */

export type KamnetTier = KamnetAgentTier;
export type LeadSource = KamnetLeadSource;
export type LeadStatus = KamnetLeadStatus;

/** Core user fields `network.service.enrichAgent` attaches to every node. */
export interface NetworkUser {
  firstName: string | null;
  lastName: string | null;
  email: string;
  country: string | null;
  city: string | null;
}

/** One agent inside a sponsorship tree, as `enrichAgent` returns it. */
export interface NetworkAgent {
  id: string;
  agentCode: string;
  tier: KamnetTier;
  salesCount: number;
  createdAt: string;
  user: NetworkUser;
}

/**
 * A node of the sponsorship tree. Recursive, and the depth is bounded by the
 * server at `KAMNET_MAX_SPONSORSHIP_DEPTH`, so the recursion terminates at N3.
 */
export interface NetworkNode {
  agent: NetworkAgent;
  referrals: NetworkNode[];
}

/** `GET /kamnet/network/sponsors` - walking UP the tree instead of down. */
export interface SponsorChain {
  agent: { id: string; agentCode: string };
  chain: Array<{ id: string; agentCode: string; level: number; name?: string }>;
}

/**
 * `GET /kamnet/agents/me`. The agent record plus the Core user, flattened the
 * way `getMyProfile` flattens it.
 */
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

/** `GET /kamnet/agents/:id` - another agent's public profile. */
export interface PublicAgentProfile {
  id: string;
  bio: string | null;
  tier: KamnetTier;
  agentCode: string;
  salesCount: number;
  referralCount: number;
}

/** A prospect, as `KamnetLead` is returned. */
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

/** A commission line. `amount` is XAF, which has no minor unit. */
export interface Commission {
  id: string;
  agentId: string;
  landId: string;
  reservationId: string;
  /** 0 = direct agent, 1 = N1, 2 = N2, 3 = N3. */
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
