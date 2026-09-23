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
import { subscribeNewsletterAction } from './newsletter';

const post = api.post as jest.MockedFunction<typeof api.post>;

/**
 * P2 - the newsletter's server action, tested on its own.
 *
 * The component tests mock this module, so they prove the form behaves given
 * an honest action. This file is what proves the action is honest - the same
 * reason `contact.spec.ts` exists.
 */
describe('subscribeNewsletterAction', () => {
  const input = { email: 'reader@example.test', locale: 'fr' as const, consent: true as const };

  beforeEach(() => jest.clearAllMocks());

  it('sends the consent and the locale, and reports success once the API stored it', async () => {
    post.mockResolvedValue(undefined as never);

    await expect(subscribeNewsletterAction(input)).resolves.toEqual({ success: true });
    expect(post).toHaveBeenCalledWith('/newsletter/subscribe', input);
  });

  it('reports an already-subscribed address as a refusal the form can name', async () => {
    post.mockRejectedValue(new ApiError('This email is already subscribed.', 409));

    await expect(subscribeNewsletterAction(input)).resolves.toEqual({
      success: false,
      error: 'This email is already subscribed.',
      status: 409,
      retryable: false,
    });
  });

  it('reports a server failure as retryable', async () => {
    post.mockRejectedValue(new ApiError('Internal server error', 500));

    await expect(subscribeNewsletterAction(input)).resolves.toEqual({
      success: false,
      error: 'Internal server error',
      status: 500,
      retryable: true,
    });
  });

  it('reports an unreachable API as retryable, with no internal message', async () => {
    post.mockRejectedValue(new TypeError('fetch failed'));

    await expect(subscribeNewsletterAction(input)).resolves.toEqual({
      success: false,
      retryable: true,
    });
  });
});
