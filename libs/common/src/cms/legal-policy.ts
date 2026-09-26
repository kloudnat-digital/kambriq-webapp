/**
 * The contract between the Sanity `legalPolicy` document, the GROQ-powered
 * webhook that projects it, and the archive that stores what it said.
 *
 * Three things read these values and none of them can see the others: the Studio
 * schema (`studio/schemaTypes/legalPolicy.ts`, a separate project with its own
 * install), the webhook configuration held by Sanity, and
 * `policy-publish.dto.ts`, which refuses a payload that does not match. A field
 * renamed in one place and not the others is a delivery that either fails or
 * archives a partial record, so the names live here once and specs pin the
 * copies against them.
 */

/** The Sanity document type. `PolicyArchiveService` refuses anything else. */
export const LEGAL_POLICY_TYPE = 'legalPolicy';

/**
 * The languages a policy exists in.
 *
 * Document-level internationalisation: each language is its own document with
 * its own id and its own revisions, which is why the archive keys on
 * `(documentId, revision)` and carries `locale` as a column.
 */
export const POLICY_LANGUAGES = ['fr', 'en'] as const;

export type PolicyLanguage = (typeof POLICY_LANGUAGES)[number];

/**
 * The policies the site serves, as slugs.
 *
 * A closed list rather than a free slug field. The slug is what consent records
 * point at and what a page is looked up by, so a value with no page behind it
 * is a policy nobody can read - and an editor cannot tell by looking at the
 * Studio.
 *
 * Each one is `apps/web/src/app/[locale]/legal/<name>/page.tsx`.
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
 * The webhook's GROQ filter: which documents, when changed, trigger a delivery.
 *
 * Deliberately no `defined(publishedAt) && defined(slug.current)`. A filter that
 * excluded an incomplete document would make publishing one archive nothing at
 * all, silently. Let it through: the DTO refuses it with a 400 that Sanity
 * records in the webhook's attempt log, where somebody can read it.
 */
export const POLICY_PUBLISH_FILTER = `_type == "${LEGAL_POLICY_TYPE}"`;

/**
 * The webhook's GROQ projection: the body Sanity POSTs.
 *
 * `language` is the Studio's field name and `locale` is this codebase's, so the
 * projection is where the two meet. Everything else is passed through under its
 * own name.
 *
 * Kept as one line because it is submitted verbatim to the Management API by
 * `scripts/sanity/upsert-policy-webhook.ts`.
 */
export const POLICY_PUBLISH_PROJECTION =
  '{_id, _rev, _type, "locale": language, slug, publishedAt, body}';

/**
 * The GROQ version the webhook's filter and projection are evaluated at, and
 * the version of the management endpoint the upsert script calls.
 */
export const POLICY_WEBHOOK_API_VERSION = 'v2025-02-19';

/** The name the webhook carries in Sanity, and the key the upsert reconciles on. */
export const POLICY_WEBHOOK_NAME = 'kambriq-policy-publish';

/**
 * The route the webhook delivers to, relative to the API's base URL.
 *
 * `api/v1` is `API_PREFIX`'s default, declared in `env.validation.ts`. The
 * upsert script takes the API's base URL from the environment and appends this,
 * so an environment that changes the prefix has to pass the whole URL.
 */
export const POLICY_WEBHOOK_PATH = '/api/v1/cms/webhooks/sanity';

/**
 * The id of the one document holding a policy in a language.
 *
 * Eight documents exist and no more. The Studio's structure opens each by id
 * and delivery fetches by the same id, so the set is closed from both ends.
 * `studio/schemaTypes/legalPolicy.ts` carries a copy, pinned by
 * `studio-schema-matches-the-contract.spec.ts`, because that project has its own
 * install and cannot import this one.
 *
 * **Hyphens, never dots.** In a public dataset Sanity treats any document whose
 * `_id` contains a period as private - the same rule that hides `drafts.*` - so
 * a dotted id is readable only with a token. The first version of this scheme
 * used dots: the documents imported, the Studio showed them, and every page on
 * the site answered 404 because the anonymous delivery client saw an empty
 * dataset. `no-dots-in-document-ids` pins it.
 */
export const policyDocumentId = (slug: string, language: string) =>
  `${LEGAL_POLICY_TYPE}-${slug}-${language}`;

/**
 * The policy a public consent checkbox refers to.
 *
 * `ContactRequest` records agreement to the privacy policy, and the API resolves
 * the archived revision of THIS slug at the moment it writes the row. It is a
 * constant rather than a path parsed out of the request, because the version a
 * consent is bound to is the server's determination - the same reason the
 * consent timestamp is the server's and not the browser's.
 */
export const CONSENT_POLICY_SLUG: PolicySlug = 'legal-privacy';
