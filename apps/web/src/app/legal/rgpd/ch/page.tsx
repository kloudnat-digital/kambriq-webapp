import { getLocale } from 'next-intl/server';

import { loadContent } from '@/lib/content';

export const metadata = {
  title: 'nLPD - Suisse | KAMBRIQ',
  description:
    'Politique de protection des données pour les résidents suisses (nouvelle Loi fédérale sur la protection des données).',
};

export default async function RgpdChPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-rgpd-ch', locale);
  return <Content />;
}
