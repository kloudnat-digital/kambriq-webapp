import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { loadContent } from '@/lib/content';
import { publicPageMetadata } from '@/lib/seo/metadata';

export const generateMetadata = (): Promise<Metadata> =>
  publicPageMetadata('/legal/rgpd', 'metadata.legal.rgpd');

export default async function RgpdPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-rgpd', locale);
  return <Content />;
}
