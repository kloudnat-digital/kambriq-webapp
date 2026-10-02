import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import type { PolicySlug } from '@kambriq/common/cms/legal-policy';
import { cmsLanguage, fetchPolicy } from '@/lib/cms/documents';
import { fetchPolicyStanding, policySource } from '@/lib/cms/policy-standing';
import { ArchivedPolicy } from './archived-policy';
import { PolicyDocument } from './policy-document';

/**
 * A legal page serves the revision in force (C41). The API is asked only when
 * Sanity's revision is not in force by its own date, so the ordinary page does
 * not depend on it.
 */
export async function LegalPolicyPage({ slug }: { slug: PolicySlug }) {
  const locale = cmsLanguage(await getLocale());
  const document = await fetchPolicy(slug, locale);
  const now = new Date();

  const sanityInForce = policySource(document, null, now) === 'document';
  const standing = sanityInForce ? null : await fetchPolicyStanding(slug, locale);

  const source = policySource(document, standing, now);
  if (source === 'document' && document) {
    return <PolicyDocument document={document} locale={locale} />;
  }
  if (source === 'archive' && standing?.inForce) {
    return (
      <ArchivedPolicy
        title={document?.title}
        inForce={standing.inForce}
        upcoming={document?.publishedAt ?? standing.upcoming?.publishedAt}
        locale={locale}
      />
    );
  }
  if (source === 'upcoming' && document) {
    return <PolicyDocument document={document} locale={locale} notYetInForce />;
  }
  // 404 rather than an empty page: a legal document that cannot be shown is one
  // the site does not have, and a soft 404 is indexed as a real page.
  notFound();
}
