import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

export async function generateMetadata() {
  const t = await getTranslations('app.adminKbs');
  return { title: t('pageTitle') };
}

export default function AdminKbsPage() {
  return (
    <PlaceholderPage
      namespace="app.adminKbs"
      titleKey="pageTitle"
      subtitleKey="subtitle"
      features={[
        'Gestion des modules et leçons',
        'Suivi des candidats en formation',
        'Résultats des examens KCA',
        'Statistiques de formation',
      ]}
      roles={['ADMIN_KBS', 'ADMIN_GLOBAL', 'ROOT']}
    />
  );
}
