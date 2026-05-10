import { getLocale } from 'next-intl/server';

import { loadContent } from '@/lib/content';

export const metadata = {
  title: 'Mandat d’accompagnement foncier | KAMBRIQ',
  description:
    'Mandat type pour l’accompagnement foncier KAMBRIQ PLAN™ - sélection, vérification et sécurisation du projet.',
};

export default async function MandatAccompagnementPage() {
  const locale = await getLocale();
  const Content = await loadContent('legal-mandat-accompagnement', locale);
  return <Content />;
}
