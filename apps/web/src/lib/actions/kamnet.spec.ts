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
// winston's console transport schedules with setImmediate, which jsdom lacks.
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));

import { ApiError, serverApi } from '@/lib/api/server';
import {
  createLead,
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
 * The KAMNET server-action layer, tested on its own.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists before the layer it tests
 * ---------------------------------------------------------------------------
 * The KAMNET API has been complete for months and five agent screens were dead
 * because this one module did not exist. The risk in writing it is not that a
 * call fails loudly - it is that it succeeds while addressing the wrong route,
 * or unwraps the wrong shape, and the screen above it renders something
 * plausible. `contact.spec.ts` was written for the same reason: the component
 * tests mocked the action, so an action that always reported success left every
 * one of them green.
 *
 * So each action is pinned to its METHOD and PATH, not merely to "it resolved".
 *
 * ---------------------------------------------------------------------------
 * The unauthenticated path, and why it differs between reads and mutations
 * ---------------------------------------------------------------------------
 * This is `kbs.ts`'s behaviour, mirrored deliberately rather than improved.
 *
 * `createAction` converts a `ServerActionError` into `{ success: false }` and
 * RETHROWS everything else. An `ApiError` is everything else. So:
 *
 *   - a read (`serverApi.get` with no try/catch) REJECTS on 401
 *   - a mutation (wrapped, throwing `ServerActionError`) RESOLVES to
 *     `{ success: false, error, status: 400 }`
 *
 * Both are asserted below. If that asymmetry is ever considered wrong it is
 * wrong in `kbs.ts` too, and the fix belongs there and in every caller - not
 * silently in this module, which step 1 requires to follow `kbs.ts` exactly.
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
    // The API documents 404 as "the caller has no KAMNET agent record". That is
    // an answer, not a fault, and the page needs to tell the two apart - so the
    // same `nullOn404` shape `kbs.ts` uses for `getMyCandidate`.
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
    // The property, stated once rather than per status code. A prospect the
    // agent believes is saved and is not is the defect this guards.
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
    expect(revalidatePath).toHaveBeenCalledWith('/agent/prospects');
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

  it('asks for the network at the depth it was given', async () => {
    get.mockResolvedValue(tree as never);

    await getMyNetwork(3);

    expect(get).toHaveBeenCalledWith('/kamnet/network?depth=3');
  });

  it('defaults to depth 1, which is the API default and the Junior rule', async () => {
    get.mockResolvedValue(tree as never);

    await getMyNetwork();

    expect(get).toHaveBeenCalledWith('/kamnet/network?depth=1');
  });

  it('refuses to ask for a depth beyond N3 rather than letting the server clamp it', async () => {
    // The API clamps with Math.min(depth, KAMNET_MAX_SPONSORSHIP_DEPTH). Relying
    // on that would make this module's contract depend on a server-side detail;
    // asking for 3 when told 9 keeps the two honest independently.
    get.mockResolvedValue(tree as never);

    await getMyNetwork(9);

    expect(get).toHaveBeenCalledWith('/kamnet/network?depth=3');
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
