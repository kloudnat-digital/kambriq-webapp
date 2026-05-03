import { getLocale } from 'next-intl/server';

import { loadContent } from '@/lib/content';

export const metadata = {
  title: 'RGPD - Union européenne | KAMBRIQ',
  description:
    'Politique de protection des données pour les résidents de l’Union européenne (RGPD - Règlement (UE) 2016/679).',
};

export default async function RgpdUePage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-rgpd-ue', locale);
  return <Content />;
}
