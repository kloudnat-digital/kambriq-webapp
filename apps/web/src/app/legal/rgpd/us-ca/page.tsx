import { getLocale } from 'next-intl/server';

import { loadContent } from '@/lib/content';

export const metadata = {
  title: 'CCPA - California | KAMBRIQ',
  description:
    'Privacy policy for California residents (CCPA / CPRA - California Consumer Privacy Act).',
};

export default async function RgpdUsCaPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-rgpd-us-ca', locale);
  return <Content />;
}
