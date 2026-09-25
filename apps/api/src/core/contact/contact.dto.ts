import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ContactSubject } from '@kambriq/common';

/**
 * DTO for public contact form submissions.
 * Provides server-side validation using Zod.
 */
export const submitContactRequestSchema = z.object({
  /**
   * The prospect's name, trimmed to prevent blank string submissions.
   */
  name: z
    .string()
    .trim()
    .min(2, 'A name is required.')
    .max(120, 'That name is longer than any real one.'),

  email: z.email('A valid email address is required - it is how we answer.'),

  /**
   * Optional international phone number.
   * Uses a generic format to accommodate various country codes.
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
   * Contact subject constrained to predefined enum values.
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
   * Enforces explicit consent by requiring a literal `true`.
   * The timestamp is recorded server-side for accurate auditing.
   */
  consent: z.literal(true, {
    message: 'We need your agreement to the privacy policy before we can hold your details.',
  }),
});

export class SubmitContactRequestDto extends createZodDto(submitContactRequestSchema) {}
