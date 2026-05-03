import { getLocale } from 'next-intl/server';

import { loadContent } from '@/lib/content';

export const metadata = {
  title: 'PIPEDA - Canada | KAMBRIQ',
  description:
    'Politique de protection des données pour les résidents canadiens (PIPEDA + Loi 25 du Québec).',
};

export default async function RgpdCaPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-rgpd-ca', locale);
  return <Content />;
}
