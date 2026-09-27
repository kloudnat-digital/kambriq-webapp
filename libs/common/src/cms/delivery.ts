/**
 * How the site reads a document out of Sanity. `legal-policy.ts` covers the
 * other direction, what Sanity POSTs on publish; both rename `language` to
 * `locale` so the rendered shape and the archived shape agree.
 *
 * Delivery uses `@sanity/client`, not `next-sanity`: the latter declares `sanity`
 * as a non-optional peer, and pnpm installs peers, so it pulls the whole Studio
 * into the root install every CI job pays for (1846 lockfile entries against
 * 128). The cost of avoiding it is `<SanityLive>` and the Presentation tool,
 * neither in use.
 */

/**
 * Pinned, not `latest`: from `v2025-02-19` the client's default perspective is
 * `published` rather than `raw`. A draft must never reach a visitor.
 */
export const CMS_API_VERSION = 'v2025-02-19';

/**
 * The fields a page renders. `publishedAt` is absent on an editorial page and
 * present on a policy; asking for it in one projection keeps delivery to a
 * single query.
 */
export const DELIVERY_PROJECTION =
  '{_id, _rev, _type, "locale": language, slug, title, publishedAt, body}';

/**
 * One document, by id rather than by a filter on slug and language: the
 * documents are singletons with deterministic ids. A filter matching two
 * documents takes the first and says nothing; an id cannot match two.
 */
export const DOCUMENT_BY_ID_QUERY = `*[_id == $id][0]${DELIVERY_PROJECTION}`;

/**
 * Next's cache window for a delivered document, in seconds.
 *
 * Sanity purges its own CDN on publish, so this is the whole delay between
 * publishing and the site changing. There is no revalidation hook: it would need
 * a second secret and route to save fifteen minutes on pages that change a few
 * times a year.
 */
export const CMS_REVALIDATE_SECONDS = 900;

/** The cache tag a delivered document carries, so a future route can target it. */
export const cmsCacheTag = (documentId: string) => `cms:${documentId}`;
