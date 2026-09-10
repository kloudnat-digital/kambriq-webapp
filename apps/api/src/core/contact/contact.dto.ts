import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ContactSubject } from '@kambriq/common';

/**
 * L1 - what the public contact form sends.
 *
 * **The client validates nothing that matters.** The browser form validates for
 * the person filling it in; this validates for the system. They are two
 * different jobs and only one of them is a guard: a client check is a courtesy
 * to somebody using the form, and anything at all can post to this route.
 *
 * The same library the rest of the repo uses (`zod` through `nestjs-zod`), the
 * same shape as `SubscribeNewsletterDto`.
 */
export const submitContactRequestSchema = z.object({
  /**
   * Trimmed before it is measured, so `"   "` is empty rather than three
   * characters long. The database CHECK refuses a blank name too.
   */
  name: z
    .string()
    .trim()
    .min(2, 'A name is required.')
    .max(120, 'That name is longer than any real one.'),

  email: z.email('A valid email address is required - it is how we answer.'),

  /**
   * Optional, and international. The form asks and does not require it.
   *
   * Deliberately not validated against a Cameroonian format: the design's own
   * client base is the diaspora, so the number arriving here is as likely to be
   * French, Belgian or Canadian as Cameroonian. A pattern that only accepted
   * `+237` would refuse most of the people this form exists to hear from.
   */
  phone: z
    .string()
    .trim()
    .min(6)
    .max(32)
    .regex(/^\+?[0-9 ().-]+$/, 'A phone number, with its international prefix.')
    .optional()
    .or(z.literal('').transform(() => undefined)),

  /**
   * From the enum, never a free string, so the six the form offers and the six
   * the database accepts cannot drift apart.
   */
  subject: z.nativeEnum(ContactSubject, {
    message: 'Choose what your request is about.',
  }),

  message: z
    .string()
    .trim()
    .min(10, 'Tell us a little about what you need, so we can answer usefully.')
    .max(5000, 'That message is too long for this form - email us directly.'),

  /** The page's language. The acknowledgement goes out in it. */
  locale: z.enum(['fr', 'en']).default('fr'),

  /**
   * **Consent, as a literal `true`.**
   *
   * `z.boolean()` would accept `false` and leave the service to remember to
   * check it. This refuses the request at the boundary, and the service refuses
   * it again, and the column is `NOT NULL`. Three layers, because this is the
   * one field with a legal meaning.
   *
   * The *timestamp* is not accepted from the wire on purpose: a client-supplied
   * consent time is a claim about the past, and the server's clock is a record.
   */
  consent: z.literal(true, {
    message: 'We need your agreement to the privacy policy before we can hold your details.',
  }),
});

export class SubmitContactRequestDto extends createZodDto(submitContactRequestSchema) {}
