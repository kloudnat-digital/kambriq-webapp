import { getLocale } from 'next-intl/server';
import { loadContent } from '@/lib/content';

export default async function TermsPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-terms', locale);
  return <Content />;
}
