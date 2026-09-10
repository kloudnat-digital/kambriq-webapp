'use server';

import { api, ApiError } from '@/lib/api/server';

/**
 * L1 - the contact form's server action.
 *
 * Same shape as `subscribeNewsletterAction`: a discriminated result the screen
 * can render, never a thrown error reaching the page.
 *
 * **What is different, and deliberately so.** The newsletter action swallows
 * every failure into one fixed English sentence. That is survivable for a
 * newsletter and not for this: a prospect who has written three paragraphs has
 * to be told something they can act on, in the language they are reading, and
 * the form has to know the difference between "we could not reach the server"
 * and "the server refused this". So the API's own message is passed through
 * when there is one, and the caller gets `retryable` to decide its wording.
 */
export type SubmitContactResult =
  | { success: true; reference: string }
  | { success: false; error?: string; retryable: boolean };

export type SubmitContactInput = {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  locale: 'fr' | 'en';
  consent: true;
};

export const submitContactRequestAction = async (
  input: SubmitContactInput,
): Promise<SubmitContactResult> => {
  try {
    const { reference } = await api.post<{ id: string; reference: string }>(
      '/contact/requests',
      input,
    );
    // Returned so the screen can show it and the prospect can quote it. The
    // acknowledgement email carries the same one.
    return { success: true, reference };
  } catch (error) {
    if (error instanceof ApiError) {
      /**
       * 4xx is the server's answer to the question asked; 5xx and a network
       * failure are ours. Only the second kind is worth pressing again, and a
       * form that invites a retry on a refusal teaches people to press twice.
       */
      return {
        success: false,
        error: error.message,
        retryable: error.status >= 500,
      };
    }
    // A TypeError here is a fetch that never reached the API. Retryable, and
    // deliberately without a message: an internal string is not something to
    // put in front of a prospect.
    return { success: false, retryable: true };
  }
};
