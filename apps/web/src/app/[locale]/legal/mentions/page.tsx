import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { loadContent } from '@/lib/content';
import { publicPageMetadata } from '@/lib/seo/metadata';

export const generateMetadata = (): Promise<Metadata> =>
  publicPageMetadata('/legal/mentions', 'metadata.legal.mentions');

export default async function MentionsLegalesPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-mentions', locale);
  return <Content />;
}
