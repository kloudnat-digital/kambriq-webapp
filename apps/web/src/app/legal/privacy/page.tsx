import { getLocale } from 'next-intl/server';
import { loadContent } from '@/lib/content';

export default async function PrivacyPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-privacy', locale);
  return <Content />;
}
