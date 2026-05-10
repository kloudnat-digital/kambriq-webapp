import { getLocale } from 'next-intl/server';

import { loadContent } from '@/lib/content';

export const metadata = {
  title: 'Protection des données - Autres pays | KAMBRIQ',
  description:
    'Politique de protection des données pour les résidents d’autres juridictions (UAE, Japon, Chine, Cameroun, etc.).',
};

export default async function RgpdGlobalPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-rgpd-global', locale);
  return <Content />;
}
