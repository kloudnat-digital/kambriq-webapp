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
  return { ApiError, api: { post: jest.fn() } };
});

import { api, ApiError } from '@/lib/api/server';
import { submitContactRequestAction } from './contact';

const post = api.post as jest.MockedFunction<typeof api.post>;

/**
 * The contact form's server action, tested on its own.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists, which is worth writing down
 * ---------------------------------------------------------------------------
 * It was written **because a mutation could not fail**. The component tests
 * mock this module, so making the action always return `{ success: true }`
 * left all twelve of them green - the form was proved to behave correctly
 * given an honest action, and nothing anywhere proved the action was honest.
 *
 * A guard nothing can redden is not a guard. This is the missing half, and it
 * is the one the mutation now fails against.
 */
describe('submitContactRequestAction', () => {
  const input = {
    name: 'Amina Nkolo',
    email: 'prospect@example.test',
    subject: 'LANDS',
    message: 'Je cherche une parcelle titree dans le Littoral.',
    locale: 'fr' as const,
    consent: true as const,
  };

  beforeEach(() => jest.clearAllMocks());

  it('reports success, with the reference, when the API stored the request', async () => {
    post.mockResolvedValue({ id: 'row-1', reference: 'KBQ-C-ABCD1234' } as never);

    await expect(submitContactRequestAction(input)).resolves.toEqual({
      success: true,
      reference: 'KBQ-C-ABCD1234',
    });
    expect(post).toHaveBeenCalledWith('/contact/requests', input);
  });

  it('reports failure when the API refuses, and does not invite a retry', async () => {
    // 4xx is the server's answer to the question asked. Pressing again asks the
    // same question, and a form that suggests it teaches people to double-send.
    post.mockRejectedValue(new ApiError('Too many requests', 429));

    await expect(submitContactRequestAction(input)).resolves.toEqual({
      success: false,
      error: 'Too many requests',
      retryable: false,
    });
  });

  it('reports a retryable failure when the API breaks', async () => {
    post.mockRejectedValue(new ApiError('Internal server error', 500));

    await expect(submitContactRequestAction(input)).resolves.toEqual({
      success: false,
      error: 'Internal server error',
      retryable: true,
    });
  });

  it('reports a retryable failure when the request never arrived', async () => {
    // A TypeError here is a fetch that never reached the API. Deliberately
    // without a message: an internal string is not something to put in front
    // of a prospect.
    post.mockRejectedValue(new TypeError('fetch failed'));

    await expect(submitContactRequestAction(input)).resolves.toEqual({
      success: false,
      retryable: true,
    });
  });

  it.each([
    ['a refusal', new ApiError('Bad request', 400)],
    ['a server error', new ApiError('Boom', 503)],
    ['a network failure', new TypeError('fetch failed')],
  ])('never reports success when the API did not confirm the write (%s)', async (_case, error) => {
    /**
     * The mutation target, stated as one property rather than three cases.
     *
     * The whole chantier is that a prospect is told "sent" only when a row
     * exists. Anything that turns a failure into `success: true` here puts the
     * defect back exactly where it was, one layer down from the timer that
     * caused it.
     */
    post.mockRejectedValue(error);

    const result = await submitContactRequestAction(input);
    expect(result.success).toBe(false);
  });
});
