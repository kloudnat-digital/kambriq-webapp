jest.mock('@/lib/api/server', () => {
  class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  }
  return {
    ApiError,
    api: { get: jest.fn() },
    serverApi: {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    },
  };
});
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
// The revalidated path is built with the request's locale, which is read from
// the referer and then the locale cookie. Without this the resolution throws,
// `revalidatePath` is never reached, and the assertion below reads
// "Number of calls: 0" - which looks like the action not revalidating at all.
jest.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers()),
  cookies: () => Promise.resolve({ get: () => undefined }),
}));
// winston's console transport schedules with setImmediate, which jsdom lacks.
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));

import { api, ApiError, serverApi } from '@/lib/api/server';
import {
  createLead,
  getPublicAgentDirectory,
  setMyPublicListing,
  deleteLead,
  getAgentProfile,
  getCommissionSummary,
  getLead,
  getMyAgentProfile,
  getMyCommissions,
  getMyLeads,
  getMyNetwork,
  getMySponsors,
  updateLead,
  updateMyAgentProfile,
} from './kamnet';

const get = serverApi.get as jest.MockedFunction<typeof serverApi.get>;
const post = serverApi.post as jest.MockedFunction<typeof serverApi.post>;
const patch = serverApi.patch as jest.MockedFunction<typeof serverApi.patch>;
const del = serverApi.delete as jest.MockedFunction<typeof serverApi.delete>;

/**
 * Validates the KAMNET server-action layer bindings.
 *
 * Pins actions to precise methods and paths to ensure correct API consumption.
 *
 * Unauthenticated behaviors:
 * - Reads (`serverApi.get`) reject on 401.
 * - Mutations (`createAction`) resolve to `{ success: false, error, status: 400 }`.
 * This aligns with existing patterns.
 */

const unauthorised = () => new ApiError('Unauthorized', 401);

describe('kamnet actions: agent profile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads my profile from kamnet/agents/me', async () => {
    get.mockResolvedValue({ id: 'a1', agentCode: 'AGT-2025-0001', tier: 'CONFIRMED' } as never);

    await expect(getMyAgentProfile()).resolves.toEqual({
      success: true,
      data: { id: 'a1', agentCode: 'AGT-2025-0001', tier: 'CONFIRMED' },
    });
    expect(get).toHaveBeenCalledWith('/kamnet/agents/me');
  });

  it('answers null when the caller has no agent record, rather than throwing', async () => {
    // Returns null for 404s (no agent record) to differentiate missing records from actual faults.
    get.mockRejectedValue(new ApiError('Not found', 404));

    await expect(getMyAgentProfile()).resolves.toEqual({ success: true, data: null });
  });

  it('rejects when unauthenticated, because a read does not swallow a 401', async () => {
    get.mockRejectedValue(unauthorised());

    await expect(getMyAgentProfile()).rejects.toThrow('Unauthorized');
  });

  it('updates my profile through PATCH kamnet/agents/me', async () => {
    patch.mockResolvedValue({ id: 'a1', bio: 'Terrain Douala' } as never);

    await expect(updateMyAgentProfile({ bio: 'Terrain Douala' })).resolves.toEqual({
      success: true,
      data: { id: 'a1', bio: 'Terrain Douala' },
    });
    expect(patch).toHaveBeenCalledWith('/kamnet/agents/me', { bio: 'Terrain Douala' });
  });

  it('reports a failure envelope when the profile update is refused', async () => {
    patch.mockRejectedValue(unauthorised());

    await expect(updateMyAgentProfile({ bio: 'x' })).resolves.toEqual({
      success: false,
      error: 'Unauthorized',
      status: 400,
    });
  });

  it("reads another agent's public profile by id, encoded", async () => {
    get.mockResolvedValue({ id: 'a2', agentCode: 'AGT-2025-0002' } as never);

    await getAgentProfile('a2/../x');

    expect(get).toHaveBeenCalledWith('/kamnet/agents/a2%2F..%2Fx');
  });
});

describe('kamnet actions: leads', () => {
  beforeEach(() => jest.clearAllMocks());

  const lead = {
    clientName: 'Amina Nkolo',
    clientEmail: 'prospect@example.test',
    clientPhone: '+237600000000',
    source: 'REFERRAL' as const,
    notes: 'Cherche une parcelle titree dans le Littoral.',
  };

  it('lists my leads as a paginated response, with filters in the query string', async () => {
    get.mockResolvedValue({
      data: [{ id: 'l1', clientName: 'Amina Nkolo', status: 'NEW' }],
      meta: { total: 1, totalPages: 1, page: 1, limit: 20 },
    } as never);

    const res = await getMyLeads({ status: 'NEW', search: 'Amina', page: 2, limit: 20 });

    expect(res).toEqual({
      success: true,
      data: {
        data: [{ id: 'l1', clientName: 'Amina Nkolo', status: 'NEW' }],
        meta: { total: 1, totalPages: 1, page: 1, limit: 20 },
      },
    });
    // `meta` survives: `server.ts` passes a meta-bearing body through unchanged,
    // so the pagination the screen needs is not unwrapped away.
    expect(get).toHaveBeenCalledWith('/kamnet/leads?status=NEW&search=Amina&page=2&limit=20');
  });

  it('asks for leads with no query string when no filters are given', async () => {
    get.mockResolvedValue({
      data: [],
      meta: { total: 0, totalPages: 0, page: 1, limit: 20 },
    } as never);

    await getMyLeads();

    expect(get).toHaveBeenCalledWith('/kamnet/leads');
  });

  it('rejects the lead list when unauthenticated', async () => {
    get.mockRejectedValue(unauthorised());

    await expect(getMyLeads()).rejects.toThrow('Unauthorized');
  });

  it('reads one lead by id', async () => {
    get.mockResolvedValue({ id: 'l1', clientName: 'Amina Nkolo' } as never);

    await getLead('l1');

    expect(get).toHaveBeenCalledWith('/kamnet/leads/l1');
  });

  it('creates a lead through POST kamnet/leads', async () => {
    post.mockResolvedValue({ id: 'l1', ...lead, status: 'NEW' } as never);

    const res = await createLead(lead);

    expect(res).toEqual({ success: true, data: { id: 'l1', ...lead, status: 'NEW' } });
    expect(post).toHaveBeenCalledWith('/kamnet/leads', lead);
  });

  it('reports a failure envelope when lead creation is refused', async () => {
    post.mockRejectedValue(new ApiError('Validation failed', 400));

    await expect(createLead(lead)).resolves.toEqual({
      success: false,
      error: 'Validation failed',
      status: 400,
    });
  });

  it('never reports success when the API did not confirm the write', async () => {
    // Asserts fallback to `{ success: false }` for unhandled rejections to prevent false positive saves.
    for (const error of [
      new ApiError('Bad request', 400),
      new ApiError('Boom', 503),
      new TypeError('fetch failed'),
    ]) {
      post.mockRejectedValue(error);
      const res = await createLead(lead);
      expect(res.success).toBe(false);
    }
  });

  it('updates a lead and revalidates the path it was told to', async () => {
    patch.mockResolvedValue({ id: 'l1', status: 'CONTACTED' } as never);
    const { revalidatePath } = jest.requireMock('next/cache');

    await updateLead('l1', { status: 'CONTACTED' }, '/agent/prospects');

    expect(patch).toHaveBeenCalledWith('/kamnet/leads/l1', { status: 'CONTACTED' });
    // Paths are prefixed to ensure cache invalidation matches locale-aware Next.js routing.
    expect(revalidatePath).toHaveBeenCalledWith('/fr/agent/prospects');
  });

  it('does not revalidate when no path is given', async () => {
    patch.mockResolvedValue({ id: 'l1' } as never);
    const { revalidatePath } = jest.requireMock('next/cache');

    await updateLead('l1', { status: 'CONTACTED' });

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('deletes a lead through DELETE kamnet/leads/:id', async () => {
    del.mockResolvedValue(undefined as never);

    await deleteLead('l1', '/agent/prospects');

    expect(del).toHaveBeenCalledWith('/kamnet/leads/l1');
  });

  it('reports a failure envelope when the delete is refused', async () => {
    del.mockRejectedValue(new ApiError('Forbidden', 403));

    await expect(deleteLead('l1')).resolves.toEqual({
      success: false,
      error: 'Forbidden',
      status: 400,
    });
  });
});

describe('kamnet actions: commissions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists my commissions as a paginated response', async () => {
    get.mockResolvedValue({
      data: [{ id: 'c1', amount: 1386176, status: 'PENDING' }],
      meta: { total: 1, totalPages: 1, page: 1, limit: 20 },
    } as never);

    await getMyCommissions({ status: 'PENDING' });

    expect(get).toHaveBeenCalledWith('/kamnet/commissions?status=PENDING');
  });

  it('reads the commission summary', async () => {
    get.mockResolvedValue({
      pending: { count: 1, totalAmount: 1386176 },
      validated: { count: 0, totalAmount: 0 },
      paid: { count: 0, totalAmount: 0 },
    } as never);

    const res = await getCommissionSummary();

    expect(res).toEqual({
      success: true,
      data: {
        pending: { count: 1, totalAmount: 1386176 },
        validated: { count: 0, totalAmount: 0 },
        paid: { count: 0, totalAmount: 0 },
      },
    });
    expect(get).toHaveBeenCalledWith('/kamnet/commissions/summary');
  });

  it('rejects the summary when unauthenticated', async () => {
    get.mockRejectedValue(unauthorised());

    await expect(getCommissionSummary()).rejects.toThrow('Unauthorized');
  });
});

describe('kamnet actions: network', () => {
  beforeEach(() => jest.clearAllMocks());

  const tree = {
    agent: { id: 'a1', agentCode: 'AGT-2025-0001', tier: 'CONFIRMED', salesCount: 6 },
    referrals: [],
  };

  it('clamps a request for a deeper tree to the one level sponsorship reaches', async () => {
    /** Enforces depth clamp to 1 using literal assertions to guard constants. */
    get.mockResolvedValue(tree as never);

    await getMyNetwork(3);

    expect(get).toHaveBeenCalledWith('/kamnet/network?depth=1');
  });

  it('defaults to depth 1, which is the API default and the Junior rule', async () => {
    get.mockResolvedValue(tree as never);

    await getMyNetwork();

    expect(get).toHaveBeenCalledWith('/kamnet/network?depth=1');
  });

  it('refuses to ask for more than sponsorship reaches, rather than letting the server clamp it', async () => {
    // Enforces client-side depth clamping to prevent dependency on API truncation behavior.
    get.mockResolvedValue(tree as never);

    await getMyNetwork(9);

    expect(get).toHaveBeenCalledWith('/kamnet/network?depth=1');
  });

  it('answers null when the caller has no agent record', async () => {
    get.mockRejectedValue(new ApiError('Not found', 404));

    await expect(getMyNetwork(1)).resolves.toEqual({ success: true, data: null });
  });

  it('rejects the network when unauthenticated', async () => {
    get.mockRejectedValue(unauthorised());

    await expect(getMyNetwork(1)).rejects.toThrow('Unauthorized');
  });

  it('reads my sponsor chain from kamnet/network/sponsors', async () => {
    get.mockResolvedValue({
      agent: { id: 'a2', agentCode: 'AGT-2025-0002' },
      chain: [{ id: 'a1', agentCode: 'AGT-2025-0001', level: 1, name: 'Eric Mbou' }],
    } as never);

    const res = await getMySponsors();

    expect(res).toEqual({
      success: true,
      data: {
        agent: { id: 'a2', agentCode: 'AGT-2025-0002' },
        chain: [{ id: 'a1', agentCode: 'AGT-2025-0001', level: 1, name: 'Eric Mbou' }],
      },
    });
    expect(get).toHaveBeenCalledWith('/kamnet/network/sponsors');
  });

  it('answers null for the sponsor chain when the caller has no agent record', async () => {
    get.mockRejectedValue(new ApiError('Not found', 404));

    await expect(getMySponsors()).resolves.toEqual({ success: true, data: null });
  });
});

/**
 * Agent directory public access and consent toggles.
 *
 * Assertions ensure public reads use `api` (unauthenticated) rather than `serverApi`,
 * to prevent unauthorized responses from triggering global login redirects.
 */
describe('kamnet actions: the public directory (P11)', () => {
  const anonymousGet = api.get as jest.MockedFunction<typeof api.get>;

  beforeEach(() => jest.clearAllMocks());

  const ENTRY = {
    firstName: 'Amina',
    lastName: 'Nkolo',
    city: 'Douala',
    country: 'CM',
    avatarUrl: null,
    kcaNumber: 'KCA-20250101-0001',
    certifiedSince: '2025-01-01T00:00:00.000Z',
  };

  it('reads the directory anonymously, from kamnet/public/agents', async () => {
    anonymousGet.mockResolvedValue([ENTRY]);

    await expect(getPublicAgentDirectory()).resolves.toEqual({ success: true, data: [ENTRY] });
    expect(anonymousGet).toHaveBeenCalledWith('/kamnet/public/agents', { cache: 'no-store' });
    expect(get).not.toHaveBeenCalled();
  });

  /**
   * Enforces `no-store` on directory reads to ensure immediate agent withdrawal visibility.
   * Guarded individually rather than globally in `baseFetch` to prevent opting all routes into dynamic rendering.
   */
  it('pins no-store on the directory read, so a withdrawal cannot be served stale', async () => {
    anonymousGet.mockResolvedValue([]);

    await getPublicAgentDirectory();

    const [, init] = anonymousGet.mock.calls[0];
    expect(init).toEqual({ cache: 'no-store' });
  });

  /** Verifies empty arrays are preserved to distinguish valid empty states from fetch failures (`null`). */
  it('answers [] for an empty register, which is not the same as null', async () => {
    anonymousGet.mockResolvedValue([]);

    const res = await getPublicAgentDirectory();

    expect(res).toEqual({ success: true, data: [] });
    expect(res.success && res.data).not.toBeNull();
  });

  it.each([
    ['the API is unreachable', () => anonymousGet.mockRejectedValue(new TypeError('fetch failed'))],
    ['the API answers 500', () => anonymousGet.mockRejectedValue(new ApiError('boom', 500))],
    ['the API is throttling', () => anonymousGet.mockRejectedValue(new ApiError('slow down', 429))],
    ['the answer is not a list', () => anonymousGet.mockResolvedValue('<html>')],
  ])('answers null when %s, never an empty directory', async (_case, arrange) => {
    arrange();

    await expect(getPublicAgentDirectory()).resolves.toEqual({ success: true, data: null });
  });
});

describe('kamnet actions: the agent consents to be listed (P11)', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([true, false])(
    'sends listed=%s to PATCH kamnet/agents/me/public-listing',
    async (listed) => {
      patch.mockResolvedValue({
        publicListingConsentAt: listed ? '2026-09-22T00:00:00.000Z' : null,
      });

      const res = await setMyPublicListing(listed);

      expect(res).toEqual({
        success: true,
        data: { publicListingConsentAt: listed ? '2026-09-22T00:00:00.000Z' : null },
      });
      expect(patch).toHaveBeenCalledWith('/kamnet/agents/me/public-listing', { listed });
    },
  );

  /** Ensures mutation errors are resolved as failure envelopes to support client-side state recovery. */
  it('reports a refusal as a failure envelope, so the control can stay put', async () => {
    patch.mockRejectedValue(new ApiError('A suspended agent cannot be listed.', 403));

    await expect(setMyPublicListing(true)).resolves.toEqual({
      success: false,
      error: 'A suspended agent cannot be listed.',
      status: 403,
    });
  });
});
