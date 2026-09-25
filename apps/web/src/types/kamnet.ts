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
 * server at `KAMNET_MAX_SPONSORSHIP_DEPTH` - 1 since P9 - so in practice the
 * recursion terminates at N1 and `referrals` on a child is empty. The type
 * stays recursive because the bound is a business rule, not a shape.
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
  /**
   * P11 - when this agent consented to appear in the public directory, or null.
   *
   * It reaches the client because `getMyProfile` spreads the agent row, and it
   * is the agent's own data, so there is nothing here they may not see. Reading
   * it for the consent control's current state is safe for a second reason:
   * `setPublicListingConsent` deletes the cached agent row, so the next read of
   * this endpoint cannot be a "listed" from before a withdrawal.
   */
  publicListingConsentAt: string | null;
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

/**
 * `GET /kamnet/agents/:id` - another AGENT's view of an agent.
 *
 * The name is a misnomer and is kept only because `getAgentProfile` and its
 * tests already use it: this route sits behind `@Roles(AGENT)` on a controller
 * carrying `@ApiBearerAuth`, so "public" here means "not private to the holder",
 * never "readable by a stranger". It carries `salesCount`, `referralCount` and
 * `tier` - the ranking and recruitment metrics the P9 arbitrage removed from
 * the public site. See `CertifiedAgentListing` below for the one a visitor sees.
 */
export interface PublicAgentProfile {
  id: string;
  bio: string | null;
  tier: KamnetTier;
  agentCode: string;
  salesCount: number;
  referralCount: number;
}

/**
 * `GET /kamnet/public/agents` - P11's directory entry, as a stranger sees it.
 *
 * Seven fields, and the list is the contract. No sales, no referrals, no
 * sponsor, no tier, no agent code, no email, no phone, no bio. The API decides
 * this in `toPublicDirectoryEntry`; this type is the shape that arrives, not a
 * second opinion about it.
 *
 * `kcaNumber` is what a reader checks against `/verify-certificate/<number>`,
 * and it is the certificate's number rather than the agent row's copy - since
 * I15 a renewal issues a new one and nothing updates that copy.
 */
export interface CertifiedAgentListing {
  firstName: string;
  lastName: string;
  city: string | null;
  country: string | null;
  avatarUrl: string | null;
  kcaNumber: string;
  /** The issue date of the certificate that stands, as an ISO string. */
  certifiedSince: string;
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
  /**
   * 0 = the agent who made the sale, 1 = their direct sponsor.
   *
   * 2 and 3 belonged to the four-level scheme P9 ended on 20 September 2026.
   * No row was ever written at either, and nothing produces them now.
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
