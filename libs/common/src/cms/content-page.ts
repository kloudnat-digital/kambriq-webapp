/**
 * The editorial pages, as a closed set.
 *
 * Same treatment as `legal-policy.ts` and for the same reason: every document
 * is a singleton opened by id, so an editor cannot create a second French
 * `about` and leave two documents claiming to be the page.
 *
 * The difference is what happens to them. A policy is archived on publish,
 * because consent has to resolve to the exact wording somebody agreed to. An
 * editorial page is not: nobody consents to it, and the current version is the
 * only one anybody asks for.
 */

import { POLICY_LANGUAGES } from './legal-policy';

/** The Sanity document type for an editorial page. */
export const CONTENT_PAGE_TYPE = 'contentPage';

/**
 * The pages the site renders from the CMS.
 *
 * Each one is a route that exists on disk; `content-pages-have-routes.spec.ts`
 * fails when a slug here has no page, because a slug with no page is content
 * nobody can reach and an editor cannot tell by looking at the Studio.
 */
export const CONTENT_PAGE_SLUGS = ['about', 'methode', 'plan', 'verify'] as const;

export type ContentPageSlug = (typeof CONTENT_PAGE_SLUGS)[number];

/** Where each page is served, for the check above. `verify` sits under products. */
export const CONTENT_PAGE_ROUTES: Record<ContentPageSlug, string> = {
  about: '/about',
  methode: '/methode',
  plan: '/plan',
  verify: '/products/verify',
};

/** Editorial pages exist in the same languages as policies. */
export const CONTENT_PAGE_LANGUAGES = POLICY_LANGUAGES;

/**
 * The id of the one document holding a page in a language.
 *
 * Deterministic, so delivery fetches by id rather than by a filter. A filter
 * can match two documents and silently take the first; an id cannot.
 *
 * Hyphens, never dots: a dot makes a document private in a public dataset. See
 * `policyDocumentId`.
 */
export const contentPageDocumentId = (slug: string, language: string) =>
  `${CONTENT_PAGE_TYPE}-${slug}-${language}`;

/**
 * The block types an editorial page may contain.
 *
 * Every one of them needs a renderer in `apps/web/src/components/cms/`, which
 * throws on a type it does not know rather than dropping it from the page.
 * `labelDefinitions` carries no content of its own - see
 * `libs/common/src/kbs/label-definitions.ts` for why the labels are not prose.
 * `table` exists because two pages carried a raw HTML table, which Portable Text
 * has no equivalent for; dropping it would have deleted the VERIFY price list.
 */
export const CONTENT_BLOCK_TYPES = ['block', 'divider', 'labelDefinitions', 'table'] as const;

export type ContentBlockType = (typeof CONTENT_BLOCK_TYPES)[number];

/**
 * The block styles an editor may choose, and the site styles.
 *
 * No `h1`. A policy's title is a field and an editorial page's heading comes
 * from the translation files, so an `h1` in a body would be a second top-level
 * heading on the page - which is a real defect rather than a taste.
 *
 * The list is enforced in the Studio rather than at render time, and that is
 * deliberate: `@portabletext/react` merges its own default components under
 * ours, so an `h5` resolves to the library's unstyled heading and never reaches
 * `onMissingComponent`. A guard that cannot fire is not a guard, so the style
 * is simply not offered.
 */
export const CONTENT_BLOCK_STYLES = ['normal', 'h2', 'h3', 'h4', 'blockquote'] as const;

/** The inline marks an editor may apply, and the site renders. */
export const CONTENT_BLOCK_DECORATORS = ['strong', 'em', 'code'] as const;

/** The list kinds an editor may use. */
export const CONTENT_BLOCK_LISTS = ['bullet', 'number'] as const;
