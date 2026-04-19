import { getLocale } from 'next-intl/server';
import { loadContent } from '@/lib/content';

export default async function RgpdPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-rgpd', locale);
  return <Content />;
}
