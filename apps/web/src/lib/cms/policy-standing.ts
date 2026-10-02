import { CMS_REVALIDATE_SECONDS } from '@kambriq/common/cms/delivery';
import type { PolicySlug } from '@kambriq/common/cms/legal-policy';
import { api } from '@/lib/api/server';
import type { CmsDocument } from './documents';

/** What the API's archive says about a legal policy (C41). */
export interface PolicyStanding {
  inForce: { revision: string; publishedAt: string; rendered: string } | null;
  upcoming: { revision: string; publishedAt: string } | null;
}

/**
 * C41 - which text a legal page serves.
 *
 * In force means the most recent revision already published. Sanity keeps one
 * published version per document, so when it holds a revision dated in the
 * future, the one in force is in the API's archive:
 *
 * - `document`: Sanity's revision is in force by its date - served as before;
 * - `archive`: Sanity holds a future revision, the archive holds the one in
 *   force - that one is served, and the next is announced;
 * - `upcoming`: nothing is in force yet - the text to come is served under a
 *   notice saying when it takes effect, never as the current one;
 * - `none`: nothing to serve.
 */
export const policySource = (
  document: CmsDocument | null,
  standing: PolicyStanding | null,
  now: Date,
): 'document' | 'archive' | 'upcoming' | 'none' => {
  if (document && (!document.publishedAt || new Date(document.publishedAt) <= now)) {
    return 'document';
  }
  if (standing?.inForce) return 'archive';
  return document ? 'upcoming' : 'none';
};

/** The standing, from the API. Cached like the CMS, so a date boundary lands within the window. */
export const fetchPolicyStanding = (slug: PolicySlug, locale: string): Promise<PolicyStanding> =>
  api.get<PolicyStanding>(`/cms/policies/${slug}/${locale}`, {
    next: { revalidate: CMS_REVALIDATE_SECONDS },
  });
