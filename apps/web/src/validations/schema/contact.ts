import * as z from 'zod';
import { ContactSubject } from '@kambriq/common/constants/core';

/**
 * Client-side validation schema for the contact form.
 * Provides immediate user feedback prior to submission.
 * Server-side validation (`submitContactRequestSchema`) acts as the definitive security guard.
 * Schemas are intentionally kept separate to allow locale-specific error keys on the client
 * and stricter domain validation on the server.
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
  /** Ensures the select component displays validation errors correctly via aria-describedby. */
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
 * Inferred type from the ContactFormResolver.
 * Error messages use i18n keys to support client-side localization.
 */
export type ContactFormSchema = z.infer<typeof ContactFormResolver>;
