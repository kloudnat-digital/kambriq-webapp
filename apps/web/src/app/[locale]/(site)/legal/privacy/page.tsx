import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { loadContent } from '@/lib/content';
import { publicPageMetadata } from '@/lib/seo/metadata';

export const generateMetadata = (): Promise<Metadata> =>
  publicPageMetadata('/legal/privacy', 'metadata.legal.privacy');

export default async function PrivacyPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-privacy', locale);
  return <Content />;
}
