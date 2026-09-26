import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { POLICY_LANGUAGES, POLICY_SLUG_PATTERN } from '@kambriq/common';

/**
 * The payload a Sanity GROQ-powered webhook projects for a legal policy.
 *
 * The projection is configured in Sanity and this schema is the contract it must
 * satisfy: a required field it stops sending fails the delivery rather than
 * archiving a partial record.
 */
export const policyPublishSchema = z.object({
  /** Document-level i18n gives each language its own document id. */
  _id: z.string().trim().min(1),

  /**
   * Provenance only. A revision resolves through Sanity's History API for three
   * days on the current plan, so it is never the retrieval path.
   */
  _rev: z.string().trim().min(1),

  /** Checked by the service, not here, so an unexpected type is not a 400. */
  _type: z.string().trim().min(1),

  locale: z.enum(POLICY_LANGUAGES),

  /**
   * Stable policy name, so consent can ask by policy rather than by Sanity id.
   *
   * The shape is checked, not the membership. `POLICY_SLUGS` is a closed list in
   * the Studio schema, where it stops an editor inventing a policy no page
   * serves; refusing it here would turn that mistake into a delivery nobody can
   * repair without an API release, and an archived row for a page that does not
   * exist costs nothing.
   */
  slug: z
    .string()
    .trim()
    .regex(POLICY_SLUG_PATTERN, 'A slug is lowercase words joined by hyphens.'),

  publishedAt: z.iso.datetime({ offset: true }),

  /**
   * `looseObject` keeps the keys each block type carries, which the renderer
   * needs. Empty is refused: an archived empty document answers nothing.
   */
  body: z.array(z.looseObject({ _type: z.string().trim().min(1) })).min(1),
});

export class PolicyPublishDto extends createZodDto(policyPublishSchema) {}

export type PolicyPublishPayload = z.infer<typeof policyPublishSchema>;
