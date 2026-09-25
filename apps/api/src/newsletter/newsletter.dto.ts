import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * P2 - what the newsletter form sends.
 *
 * **The client validates nothing that matters.** The browser form validates
 * for the person filling it in; this validates for the system, because the
 * route is public and anything at all can post to it. Same shape as
 * `submitContactRequestSchema`.
 */
export const subscribeNewsletterSchema = z.object({
  email: z.email('A valid email address is required.'),

  /** The page's language, stored on the contact with the consent. */
  locale: z.enum(['fr', 'en']).default('fr'),

  /**
   * **Consent, as a literal `true`.** `z.boolean()` would accept `false` and
   * leave the service to remember to check it. The service refuses it again.
   *
   * The *timestamp* is not accepted from the wire on purpose: a client-supplied
   * consent time is a claim about the past, and the server's clock is a record.
   */
  consent: z.literal(true, {
    message: 'We need your agreement to the privacy policy before we can hold your address.',
  }),
});

export class SubscribeNewsletterDto extends createZodDto(subscribeNewsletterSchema) {}
