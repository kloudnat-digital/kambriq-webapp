import * as z from 'zod';
import { KamnetLeadSource } from '@kambriq/common/constants/kamnet';

/**
 * What the prospect form asks for, checked in the browser.
 *
 * **A courtesy, not a guard**, exactly as `contact.ts` says of itself: it tells
 * an agent what is missing before they wait for a round trip. The guard is
 * `createLeadSchema` in the API, which validates again on the server.
 *
 * The two are deliberately not shared. The server's version is the authority on
 * what the column will hold; this one carries message KEYS so the same schema
 * can speak French and English, and the component looks each key up in the
 * page's catalogue. A resolver that hard-coded sentences would show the wrong
 * language to half the agents.
 *
 * ---------------------------------------------------------------------------
 * Why every field is required here
 * ---------------------------------------------------------------------------
 * `KamnetLead` makes `clientEmail`, `clientPhone`, `source` and `notes`
 * nullable, but `createLeadSchema` on the API makes all four REQUIRED:
 *
 *   clientEmail: z.email()
 *   clientPhone: z.string().max(20)
 *   source:      z.enum(KamnetLeadSource)
 *   notes:       z.string().max(2000)
 *
 * The column and the endpoint disagree, and the endpoint is what the screen
 * talks to. Asking for less than it requires would produce a 400 the agent
 * could not act on, so the form asks for what the API will accept. The gap
 * itself is reported rather than papered over.
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
  /**
   * The same trap `contact.ts` documents: a `required` attribute on a Radix
   * Select renders a 1x1 native control the browser can neither focus nor
   * annotate, so the rule lives in the resolver and the message renders under
   * the trigger, tied by `aria-describedby`.
   */
  source: z.enum(KamnetLeadSource, { error: 'sourceRequired' }),
  notes: z.string().trim().min(1, { error: 'notesRequired' }).max(2000, { error: 'notesTooLong' }),
});

export type ProspectFormSchema = z.infer<typeof ProspectFormResolver>;
