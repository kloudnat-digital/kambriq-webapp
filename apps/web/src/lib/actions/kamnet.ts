'use server';

import { revalidatePath } from 'next/cache';
import { KAMNET_MAX_SPONSORSHIP_DEPTH } from '@kambriq/common/constants/kamnet';
import { ApiError, serverApi } from '@/lib/api/server';
import { createAction, ServerActionError } from './create-action';
import type {
  Commission,
  CommissionFilters,
  CommissionSummary,
  CreateLeadInput,
  Lead,
  LeadFilters,
  MyAgentProfile,
  NetworkNode,
  PublicAgentProfile,
  SponsorChain,
  UpdateAgentProfileInput,
  UpdateLeadInput,
} from '@/types/kamnet';
import type { PaginatedResponse } from '@/types/api';

/**
 * The KAMNET server actions.
 *
 * This file is the whole gap between a complete KAMNET API - sixteen endpoints,
 * shipped and tested - and five agent screens that render nothing. It follows
 * `kbs.ts` exactly rather than better: same `createAction` wrapper, same
 * `nullOn404`, same split between reads that let an error propagate and
 * mutations that convert one into a failure envelope. Where that split looks
 * odd, it is odd in `kbs.ts` too, and changing it here alone would give the
 * application two conventions for the same thing.
 */

/**
 * Identical to `kbs.ts`'s helper, and needed for the same reason: some 404s are
 * answers rather than faults. The API documents "the caller has no KAMNET agent
 * record" as a 404 on three routes, and a screen must tell "you are not an
 * agent" apart from "something broke".
 */
const nullOn404 = async <T>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
};

const queryString = (params: Record<string, string | number | undefined>): string => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : '';
};

// ==== Agent profile ====

/**
 * The caller's own agent record. `null` when they have none, which is the
 * ordinary state for every user who is not a KAMNET agent.
 */
export const getMyAgentProfile = createAction(async () => {
  return nullOn404(() => serverApi.get<MyAgentProfile>('/kamnet/agents/me'));
});

export const updateMyAgentProfile = createAction(
  async (data: UpdateAgentProfileInput, revalidate?: string) => {
    try {
      const result = await serverApi.patch<MyAgentProfile>('/kamnet/agents/me', data);
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Agent profile update failed.',
        400,
      );
    }
  },
);

export const getAgentProfile = createAction(async (agentId: string) => {
  return serverApi.get<PublicAgentProfile>(`/kamnet/agents/${encodeURIComponent(agentId)}`);
});

// ==== Leads ====

export const getMyLeads = createAction(async (filters?: LeadFilters) => {
  const qs = queryString({
    status: filters?.status,
    search: filters?.search,
    page: filters?.page,
    limit: filters?.limit,
  });
  return serverApi.get<PaginatedResponse<Lead>>(`/kamnet/leads${qs}`);
});

export const getLead = createAction(async (leadId: string) => {
  return serverApi.get<Lead>(`/kamnet/leads/${encodeURIComponent(leadId)}`);
});

export const createLead = createAction(async (data: CreateLeadInput, revalidate?: string) => {
  try {
    const result = await serverApi.post<Lead>('/kamnet/leads', data);
    if (revalidate) revalidatePath(revalidate);
    return result;
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Lead creation failed.',
      400,
    );
  }
});

export const updateLead = createAction(
  async (leadId: string, data: UpdateLeadInput, revalidate?: string) => {
    try {
      const result = await serverApi.patch<Lead>(
        `/kamnet/leads/${encodeURIComponent(leadId)}`,
        data,
      );
      if (revalidate) revalidatePath(revalidate);
      return result;
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Lead update failed.',
        400,
      );
    }
  },
);

export const deleteLead = createAction(async (leadId: string, revalidate?: string) => {
  try {
    const result = await serverApi.delete(`/kamnet/leads/${encodeURIComponent(leadId)}`);
    if (revalidate) revalidatePath(revalidate);
    return result;
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Lead delete failed.',
      400,
    );
  }
});

// ==== Commissions ====

export const getMyCommissions = createAction(async (filters?: CommissionFilters) => {
  const qs = queryString({
    status: filters?.status,
    page: filters?.page,
    limit: filters?.limit,
  });
  return serverApi.get<PaginatedResponse<Commission>>(`/kamnet/commissions${qs}`);
});

export const getCommissionSummary = createAction(async () => {
  return serverApi.get<CommissionSummary>('/kamnet/commissions/summary');
});

// ==== Network ====

/**
 * The caller's sponsorship tree, down to `depth`.
 *
 * The depth is clamped HERE as well as on the server. The server does clamp -
 * `Math.min(depth, KAMNET_MAX_SPONSORSHIP_DEPTH)` - but a caller that relies on
 * that has a contract defined by somebody else's implementation detail, and the
 * day the clamp moves this module starts asking for something it cannot render.
 * Two independent clamps on the same constant cost nothing.
 *
 * Note what this function does NOT do: it does not decide which depth a tier is
 * entitled to. `GET /kamnet/network` never reads the caller's tier, so that
 * rule lives nowhere on the server today and the page applies it. That is a
 * presentation choice over an unenforced endpoint, not a security boundary, and
 * it is reported as such.
 */
export const getMyNetwork = createAction(async (depth?: number) => {
  // `depth?: number` rather than `depth = 1`. A default parameter makes
  // `createAction`'s `Args` generic infer as `[]`, so the body sees `Args[0]`
  // and `tsc` refuses it. `kbs.ts` has the same shape everywhere it takes an
  // optional argument - `params?:`, `flagged?:` - and this follows it.
  const safeDepth = Math.min(Math.max(depth ?? 1, 1), KAMNET_MAX_SPONSORSHIP_DEPTH);
  return nullOn404(() => serverApi.get<NetworkNode>(`/kamnet/network?depth=${safeDepth}`));
});

export const getMySponsors = createAction(async () => {
  return nullOn404(() => serverApi.get<SponsorChain>('/kamnet/network/sponsors'));
});
