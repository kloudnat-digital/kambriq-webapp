/**
 * The contract between the Sanity `legalPolicy` document, the webhook that
 * projects it, and the archive that stores it.
 *
 * Three consumers hold copies and none can see the others: the Studio schema
 * (`studio/schemaTypes/legalPolicy.ts`, a separate project with its own
 * install), the webhook configuration held by Sanity, and
 * `policy-publish.dto.ts`. A field renamed in one place and not the others
 * delivers nothing or archives a partial record, so the names are defined here
 * and specs pin the copies against them.
 */

/** The Sanity document type. `PolicyArchiveService` refuses anything else. */
export const LEGAL_POLICY_TYPE = 'legalPolicy';

/**
 * Document-level internationalisation: each language is its own document with
 * its own id and revisions, which is why the archive keys on
 * `(documentId, revision)` and carries `locale` as a column.
 */
export const POLICY_LANGUAGES = ['fr', 'en'] as const;

export type PolicyLanguage = (typeof POLICY_LANGUAGES)[number];

/**
 * The policies the site serves. A closed list, not a free slug field: the slug is
 * what consent records point at and what a page is looked up by, so a slug with
 * no page behind it is a policy nobody can read and the Studio gives no sign of
 * it. Each must resolve to a `legal/<name>` page, which
 * `studio-schema-matches-the-contract.spec.ts` checks against the route tree.
 */
export const POLICY_SLUGS = [
  'legal-mentions',
  'legal-privacy',
  'legal-rgpd',
  'legal-terms',
] as const;

export type PolicySlug = (typeof POLICY_SLUGS)[number];

/** Lowercase words joined by single hyphens. */
export const POLICY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Which documents trigger a delivery when changed.
 *
 * Deliberately no `defined(publishedAt) && defined(slug.current)`: a filter that
 * excluded an incomplete document would make publishing it archive nothing,
 * silently. It is let through so the DTO can refuse it with a 400, which Sanity
 * records in the webhook's attempt log.
 */
export const POLICY_PUBLISH_FILTER = `_type == "${LEGAL_POLICY_TYPE}"`;

/**
 * The body Sanity POSTs. `language` is the Studio's field name and `locale` is
 * this codebase's, so the rename happens here; everything else passes through.
 * One line, because `scripts/sanity/upsert-policy-webhook.ts` submits it
 * verbatim to the Management API.
 */
export const POLICY_PUBLISH_PROJECTION =
  '{_id, _rev, _type, "locale": language, slug, publishedAt, body}';

/** The GROQ version the filter and projection are evaluated at. */
export const POLICY_WEBHOOK_API_VERSION = 'v2025-02-19';

/** The name the webhook carries in Sanity, and the key the upsert reconciles on. */
export const POLICY_WEBHOOK_NAME = 'kambriq-policy-publish';

/**
 * The route the webhook delivers to. It carries `api/v1`, which is
 * `API_PREFIX`'s default: the upsert script appends this to the API's base URL,
 * so an environment that changes the prefix must pass the whole URL instead.
 */
export const POLICY_WEBHOOK_PATH = '/api/v1/cms/webhooks/sanity';

/**
 * The id of the one document holding a policy in a language. Eight exist and no
 * more: the Studio opens each by id and delivery fetches by the same id, so the
 * set is closed from both ends. `studio/schemaTypes/legalPolicy.ts` holds a copy
 * it cannot import, pinned by `studio-schema-matches-the-contract.spec.ts`.
 *
 * **Hyphens, never dots.** In a public dataset Sanity treats any `_id`
 * containing a period as private - the rule that hides `drafts.*` - so a dotted
 * id is readable only with a token, and every page answers 404 for the anonymous
 * delivery client while the Studio shows the document. `initial-content.spec.ts`
 * pins it.
 */
export const policyDocumentId = (slug: string, language: string) =>
  `${LEGAL_POLICY_TYPE}-${slug}-${language}`;

/**
 * The policy a public consent checkbox refers to. The API resolves the archived
 * revision of this slug when it writes the row. A constant rather than a value
 * from the request: which version a consent binds to is the server's
 * determination, like the consent timestamp.
 */
export const CONSENT_POLICY_SLUG: PolicySlug = 'legal-privacy';
