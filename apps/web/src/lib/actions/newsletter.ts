'use server';

import { api, ApiError } from '@/lib/api/server';

/**
 * P2 - the newsletter form's server action.
 *
 * Same shape as `submitContactRequestAction`: a discriminated result the screen
 * renders, never a thrown error reaching the page. It passes the API's answer
 * through rather than collapsing every failure into one fixed sentence, and
 * says whether pressing again could help; the form chooses the words from its
 * catalogue. `status` is carried so an already-subscribed
 * address (409) can be named rather than reported as a failure.
 */
export type SubscribeNewsletterResult =
  | { success: true }
  | { success: false; error?: string; status?: number; retryable: boolean };

export type SubscribeNewsletterInput = {
  email: string;
  locale: 'fr' | 'en';
  consent: true;
};

export const subscribeNewsletterAction = async (
  input: SubscribeNewsletterInput,
): Promise<SubscribeNewsletterResult> => {
  try {
    await api.post('/newsletter/subscribe', input);
    return { success: true };
  } catch (error) {
    if (error instanceof ApiError) {
      // 4xx is the server's answer to the question asked; 5xx is ours. Only the
      // second is worth pressing again.
      return {
        success: false,
        error: error.message,
        status: error.status,
        retryable: error.status >= 500,
      };
    }
    // A fetch that never reached the API. Retryable, and without a message: an
    // internal string is not something to put in front of a reader.
    return { success: false, retryable: true };
  }
};
