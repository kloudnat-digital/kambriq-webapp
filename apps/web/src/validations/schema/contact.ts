import * as z from 'zod';
import { ContactSubject } from '@kambriq/common/constants/core';

/**
 * L1 - what the contact form asks for, checked in the browser.
 *
 * **This is a courtesy, not a guard.** It tells somebody filling in the form
 * what is missing before they wait for a round trip. The guard is
 * `submitContactRequestSchema` in the API, which validates the same fields
 * again on the server, because anything at all can post to that route and the
 * browser's opinion of a payload is not evidence about it.
 *
 * The two are deliberately not shared as one object: the server's version
 * refuses things this one cannot see (consent as a literal `true`, a locale
 * outside the published pair) and this one carries messages in the page's
 * language, which the API has no business knowing.
 */
export const ContactFormResolver = z.object({
  name: z.string().trim().min(2, { error: 'nameRequired' }).max(120, { error: 'nameTooLong' }),
  email: z.email({ error: 'emailInvalid' }),
  /** Optional. Empty string is "not given", not a validation failure. */
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ().-]{6,32}$/, { error: 'phoneInvalid' })
    .optional()
    .or(z.literal('')),
  /**
   * The field the audit found unvalidatable. A `required` attribute on a
   * visually hidden native select produced no message anybody could see; this
   * produces one the component renders under the trigger.
   */
  subject: z.nativeEnum(ContactSubject, { error: 'subjectRequired' }),
  message: z
    .string()
    .trim()
    .min(10, { error: 'messageTooShort' })
    .max(5000, { error: 'messageTooLong' }),
  /** Required, and `true` specifically. An unticked box is not consent. */
  consent: z.literal(true, { error: 'consentRequired' }),
});

/**
 * Errors carry a message **key**, not a sentence.
 *
 * The schema is imported by a client component that is rendered in French and
 * in English, and a resolver that hard-codes either would show the wrong one to
 * half the visitors. The component looks the key up in the page's catalogue.
 */
export type ContactFormSchema = z.infer<typeof ContactFormResolver>;
