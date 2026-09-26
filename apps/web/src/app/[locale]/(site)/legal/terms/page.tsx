import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { loadContent } from '@/lib/content';
import { publicPageMetadata } from '@/lib/seo/metadata';

export const generateMetadata = (): Promise<Metadata> =>
  publicPageMetadata('/legal/terms', 'metadata.legal.terms');

export default async function TermsPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-terms', locale);
  return <Content />;
}
