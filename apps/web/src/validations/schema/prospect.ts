import * as z from 'zod';
import { KamnetLeadSource } from '@kambriq/common/constants/kamnet';

/**
 * Client-side validation schema for the prospect form.
 * Provides immediate UI feedback using i18n keys for localization.
 *
 * Note: While the database model allows nullability for `clientEmail`, `clientPhone`,
 * `source`, and `notes`, the API endpoint requires them. The schema enforces these
 * fields to prevent HTTP 400 errors during submission.
 */
export const ProspectFormResolver = z.object({
  clientName: z
    .string()
    .trim()
    .min(2, { error: 'clientNameRequired' })
    .max(200, { error: 'clientNameTooLong' }),
  clientEmail: z.email({ error: 'clientEmailInvalid' }),
  clientPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ().-]{6,20}$/, { error: 'clientPhoneInvalid' }),
  /** Validates the Radix Select component, allowing error messages to render under the trigger. */
  source: z.enum(KamnetLeadSource, { error: 'sourceRequired' }),
  notes: z.string().trim().min(1, { error: 'notesRequired' }).max(2000, { error: 'notesTooLong' }),
});

export type ProspectFormSchema = z.infer<typeof ProspectFormResolver>;
