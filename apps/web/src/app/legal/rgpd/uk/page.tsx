import { getLocale } from 'next-intl/server';

import { loadContent } from '@/lib/content';

export const metadata = {
  title: 'GDPR - United Kingdom | KAMBRIQ',
  description: 'Data protection policy for UK residents (UK GDPR + Data Protection Act 2018).',
};

export default async function RgpdUkPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-rgpd-uk', locale);
  return <Content />;
}
