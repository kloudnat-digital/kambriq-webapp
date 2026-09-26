import { z } from 'zod';
import {
  CMS_REVALIDATE_SECONDS,
  DOCUMENT_BY_ID_QUERY,
  cmsCacheTag,
} from '@kambriq/common/cms/delivery';
import { contentPageDocumentId, type ContentPageSlug } from '@kambriq/common/cms/content-page';
import {
  POLICY_LANGUAGES,
  policyDocumentId,
  type PolicyLanguage,
  type PolicySlug,
} from '@kambriq/common/cms/legal-policy';
import { cmsClient } from './client';

/**
 * Reading one document out of Sanity.
 *
 * The shape is CHECKED rather than asserted. A declared type that disagrees with
 * the runtime recruits the compiler into agreeing with the defect - this
 * repository has that entry twice over - and here the runtime is a third party's
 * response to a query written in another file.
 */

const blockSchema = z.object({ _type: z.string() }).loose();

const documentSchema = z.object({
  _id: z.string().min(1),
  _rev: z.string().min(1),
  _type: z.string().min(1),
  locale: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  /**
   * At least one block. An empty body is a document somebody created and never
   * wrote, and rendering it would produce a page with a heading and nothing
   * under it - which reads as the page working.
   */
  body: z.array(blockSchema).min(1),
});

export type CmsDocument = z.infer<typeof documentSchema>;

/**
 * One published document by id, or `null`.
 *
 * `null` covers all four ways there may be nothing to render: no CMS
 * configured, no document, a document whose body is empty, and a response that
 * does not match the contract. The caller answers 404 for every one of them,
 * because a page that cannot show its content has none - and a soft 404 over a
 * 200 is worse than the honest status.
 *
 * A failure to REACH Sanity is deliberately not caught here. It is a fault, not
 * an absence, and swallowing it would turn an outage into a site that quietly
 * reports every page as missing.
 */
export async function fetchCmsDocument(id: string): Promise<CmsDocument | null> {
  const client = cmsClient();
  if (!client) return null;

  const raw = await client.fetch(
    DOCUMENT_BY_ID_QUERY,
    { id },
    {
      cache: 'force-cache',
      next: { revalidate: CMS_REVALIDATE_SECONDS, tags: [cmsCacheTag(id)] },
    },
  );

  if (raw === null || raw === undefined) return null;

  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) {
    // Loud, because a document that exists and does not match the contract is a
    // Studio change nobody carried over, not a page that has not been written.
    console.error(`[cms] ${id} does not match the delivery contract`, parsed.error.issues);
    return null;
  }

  return parsed.data;
}

/**
 * The locale as a language the CMS knows, refusing anything else.
 *
 * `routing.ts` restricts the `[locale]` segment to these two, so the throw is
 * unreachable from a URL. It is here rather than a fallback to `en` because a
 * helper that cannot know the answer and returns a plausible one is how a whole
 * audience gets served the wrong language with a green suite.
 */
export function cmsLanguage(locale: string): PolicyLanguage {
  if ((POLICY_LANGUAGES as readonly string[]).includes(locale)) return locale as PolicyLanguage;
  throw new Error(`"${locale}" is not a language the CMS carries (${POLICY_LANGUAGES.join(', ')})`);
}

/** A legal document, in the language the visitor is reading. */
export const fetchPolicy = (slug: PolicySlug, locale: string): Promise<CmsDocument | null> =>
  fetchCmsDocument(policyDocumentId(slug, locale));

/** An editorial page, in the language the visitor is reading. */
export const fetchContentPage = (
  slug: ContentPageSlug,
  locale: string,
): Promise<CmsDocument | null> => fetchCmsDocument(contentPageDocumentId(slug, locale));
