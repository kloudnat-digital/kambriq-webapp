import * as z from 'zod';

/**
 * P2 - what the newsletter form asks for, checked in the browser.
 *
 * **This is a courtesy, not a guard.** The guard is `subscribeNewsletterSchema`
 * in the API, which refuses the same things again on the server. Same shape as
 * `ContactFormResolver`.
 *
 * Errors carry a message **key**, not a sentence: the form renders in French
 * and in English, and the component looks the key up in the page's catalogue
 * (`footer.newsletter.validation`). The previous resolver hard-coded one
 * English sentence on a French site.
 */
export const SubscribeNewsletterResolver = z.object({
  email: z.email({ error: 'emailInvalid' }),
  /** Required, and `true` specifically. An unticked box is not consent. */
  consent: z.literal(true, { error: 'consentRequired' }),
});

export type SubscribeNewsletterSchema = z.infer<typeof SubscribeNewsletterResolver>;
