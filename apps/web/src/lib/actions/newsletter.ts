'use server';

import { api } from '@/lib/api/server';

type ActionResult = { success: true } | { success: false; error: string };

export const subscribeNewsletterAction = async (email: string): Promise<ActionResult> => {
  try {
    await api.post('/newsletter/subscribe', { email });
    return { success: true };
  } catch {
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
};
