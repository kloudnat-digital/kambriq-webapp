import * as z from 'zod';

export const SubscribeNewsletterResolver = z.object({
  email: z.email({
    error: 'Please enter a valid email address',
  }),
});

export type SubscribeNewsletterSchema = z.infer<typeof SubscribeNewsletterResolver>;
