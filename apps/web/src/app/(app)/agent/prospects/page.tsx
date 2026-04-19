import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

export async function generateMetadata() {
  const t = await getTranslations('app.prospects');
  return { title: t('pageTitle') };
}

export default function ProspectsPage() {
  return (
    <PlaceholderPage
      namespace="app.prospects"
      titleKey="pageTitle"
      subtitleKey="subtitle"
      features={[
        'Liste des prospects avec statut',
        'Ajout de nouveaux prospects',
        'Suivi du parcours prospect → client',
        'Historique des interactions',
      ]}
      roles={['AGENT', 'OPS', 'ADMIN_GLOBAL', 'ROOT']}
    />
  );
}
