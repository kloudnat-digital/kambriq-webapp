'use server';

import { KAMNET_MAX_SPONSORSHIP_DEPTH } from '@kambriq/common/constants/kamnet';
import { api, ApiError, serverApi } from '@/lib/api/server';
import { logger } from '@/lib/logger';
import { revalidateLocalisedPath } from './revalidate';
import { createAction, ServerActionError } from './create-action';
import type {
  CertifiedAgentListing,
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
      if (revalidate) await revalidateLocalisedPath(revalidate);
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
    if (revalidate) await revalidateLocalisedPath(revalidate);
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
      if (revalidate) await revalidateLocalisedPath(revalidate);
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
    if (revalidate) await revalidateLocalisedPath(revalidate);
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
 * Since P9 that constant is 1, so every request resolves to N1 whatever the
 * caller asks for.
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

// ==== Public: the directory of certified agents (P11) ====

/**
 * `GET /kamnet/public/agents`, read by a visitor with no account.
 *
 * Through `api`, not `serverApi`. The reader is anonymous by definition - that
 * is who the directory exists for - and `serverApi` redirects a caller with an
 * expired session to a login page instead of answering, which would turn a
 * public page into a members' area for anybody whose cookie had gone stale.
 *
 * ---------------------------------------------------------------------------
 * `[]` and `null` are different answers and must stay different
 * ---------------------------------------------------------------------------
 * An empty array means **nobody has consented yet**, which is the ordinary
 * state on the day this ships and which the page says in words. `null` means
 * **the register could not be read**. Collapsing the second into the first
 * would make an outage render as "no certified agents", which is a false
 * statement about the business to the exact visitor the directory is meant to
 * reassure.
 *
 * `toCertificateVerdict` draws the same line with `unavailable`, for the same
 * reason, and `verify-certificate`'s page tests are mostly about that case.
 *
 * The shape is checked before it is trusted: an API that answered with
 * something that is not an array - an error envelope, an HTML error page - is
 * `null`, not an empty directory.
 */
export const getPublicAgentDirectory = createAction(
  async (): Promise<CertifiedAgentListing[] | null> => {
    try {
      // `cache: 'no-store'` is the promise, made explicit.
      //
      // Withdrawal takes effect immediately, and until this option was here
      // that rested entirely on Next 16 happening to default `fetch` to
      // uncached. Nothing in this repository pinned it, so a framework default
      // - or one wrapper adding `next: { revalidate }` upstream - could have
      // served a withdrawn agent for the length of a TTL.
      //
      // Pinned HERE rather than in `baseFetch`: an explicit `no-store` opts its
      // route into dynamic rendering in Next 16, so moving it into the shared
      // helper would change the rendering mode of every static page,
      // `generateMetadata` and sitemap that reaches it. This page is already
      // `force-dynamic`, so the option changes nothing about how it renders -
      // it only removes the dependence on a default.
      const body = await api.get<unknown>('/kamnet/public/agents', { cache: 'no-store' });
      if (!Array.isArray(body)) {
        logger.error('PublicAgentDirectoryUnexpectedShape', { received: typeof body });
        return null;
      }
      return body as CertifiedAgentListing[];
    } catch (error) {
      logger.error('PublicAgentDirectoryUnavailable', {
        status: error instanceof ApiError ? error.status : undefined,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  },
);

/**
 * `PATCH /kamnet/agents/me/public-listing` - the agent's own decision.
 *
 * `listed` is a REQUIRED positional argument, not an optional one with a
 * default. A default parameter makes `createAction`'s `Args` generic infer as
 * `[]`, so the body cannot see the argument and `tsc` refuses it - the same
 * reason `getMyNetwork` above takes `depth?: number` and clamps inside rather
 * than defaulting in the signature.
 *
 * Both paths are revalidated because one write changes two pages: the agent's
 * own screen, so the control shows what they just chose, and the public
 * directory, because a withdrawal has to be visible where it matters. The
 * server also deletes the cached agent row, so this is the second of two
 * independent defences against a stale "listed".
 */
export const setMyPublicListing = createAction(async (listed: boolean) => {
  try {
    const result = await serverApi.patch<{ publicListingConsentAt: string | null }>(
      '/kamnet/agents/me/public-listing',
      { listed },
    );

    // Through the localised helper, not `revalidatePath` directly: client
    // components read their path from next-intl's `usePathname`, which strips
    // the locale, and `revalidatePath` matches on the route file structure - so
    // an unprefixed path now invalidates nothing and says nothing.
    await revalidateLocalisedPath('/agent/profile');
    await revalidateLocalisedPath('/products/kamnet/annuaire');

    return result;
  } catch (error) {
    if (error instanceof ApiError) throw new ServerActionError(error.message, error.status);
    throw error;
  }
});
