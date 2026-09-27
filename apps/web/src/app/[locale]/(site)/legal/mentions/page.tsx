import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { PolicyDocument } from '@/components/cms/policy-document';
import { cmsLanguage, fetchPolicy } from '@/lib/cms/documents';
import { publicPageMetadata } from '@/lib/seo/metadata';

export const generateMetadata = (): Promise<Metadata> =>
  publicPageMetadata('/legal/mentions', 'metadata.legal.mentions');

export default async function MentionsPage() {
  const locale = cmsLanguage(await getLocale());
  const document = await fetchPolicy('legal-mentions', locale);

  // 404 rather than an empty page. A legal document that cannot be shown is one
  // the site does not have, and a soft 404 over a 200 is indexed as a real page.
  if (!document) notFound();

  return <PolicyDocument document={document} locale={locale} />;
}
