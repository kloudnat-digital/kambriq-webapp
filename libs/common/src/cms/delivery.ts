/**
 * How the site reads a document out of Sanity.
 *
 * This is the other direction from `legal-policy.ts`, which describes what
 * Sanity POSTs to us when somebody publishes. Both are GROQ and both rename
 * `language` to `locale`, so the shape a page renders and the shape the archive
 * stores agree without anybody remembering to keep them in step.
 *
 * Delivery is `@sanity/client` rather than `next-sanity`. Measured on
 * 2026-09-26: `next-sanity@13.3.4` declares `sanity` as a non-optional peer, and
 * pnpm installs peers, so adding it takes the whole Studio - `sanity@6.16.0`,
 * styled-components, vite, rolldown, typescript 7 - into the root install that
 * every CI job, both image builds and the journeys pay for. 1846 lockfile
 * entries against 128 for `@sanity/client` plus `@portabletext/react`.
 * `peerDependencyRules.ignoreMissing` and `packageExtensions` both left it
 * unchanged; only turning `autoInstallPeers` off repo-wide removes it, and that
 * changes resolution for every other package.
 *
 * What that costs is `<SanityLive>` and the Presentation tool, neither of which
 * is in use. See CLAUDE.md, "a peer dependency is your install too".
 */

/**
 * The GROQ and delivery API version.
 *
 * Pinned, not `latest`: from `v2025-02-19` the client's default perspective is
 * `published` rather than `raw`, which is the behaviour this delivery depends on
 * - a draft must never reach a visitor.
 */
export const CMS_API_VERSION = 'v2025-02-19';

/**
 * The fields a page renders.
 *
 * `"locale": language` is the same rename `POLICY_PUBLISH_PROJECTION` makes.
 * `publishedAt` is absent on an editorial page and present on a policy; asking
 * for it in one projection keeps delivery to a single query.
 */
export const DELIVERY_PROJECTION =
  '{_id, _rev, _type, "locale": language, slug, title, publishedAt, body}';

/**
 * The delivery query: one document, by id.
 *
 * By id rather than by a filter on slug and language, because the documents are
 * singletons with deterministic ids. A filter that matches two documents takes
 * the first and says nothing; an id that matches two is impossible.
 */
export const DOCUMENT_BY_ID_QUERY = `*[_id == $id][0]${DELIVERY_PROJECTION}`;

/**
 * How long a delivered document is cached by Next, in seconds.
 *
 * Fifteen minutes. Sanity purges its own CDN on publish, so this window is the
 * only delay between publishing and the site changing, and an editor is told
 * that number rather than left to guess it. There is no revalidation hook: a
 * second write path from Sanity into the web would need its own secret and its
 * own route, and the thing it would buy is fifteen minutes on a page that
 * changes a few times a year.
 */
export const CMS_REVALIDATE_SECONDS = 900;

/** The cache tag a delivered document carries, so a future route can target it. */
export const cmsCacheTag = (documentId: string) => `cms:${documentId}`;
