import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

export async function generateMetadata() {
  const t = await getTranslations('app.adminEscalations');
  return { title: t('pageTitle') };
}

export default function AdminEscalationsPage() {
  return (
    <PlaceholderPage
      namespace="app.adminEscalations"
      titleKey="pageTitle"
      subtitleKey="subtitle"
      features={[
        'Liste de toutes les escalades',
        'Filtres par priorité et statut',
        'Attribution et traitement',
        'Historique des résolutions',
      ]}
      roles={['OPS', 'ADMIN_GLOBAL', 'ROOT']}
    />
  );
}
