import { getLocale } from 'next-intl/server';
import { loadContent } from '@/lib/content';

export default async function MentionsLegalesPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-mentions', locale);
  return <Content />;
}
