import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

export async function generateMetadata() {
  const t = await getTranslations('app.adminKamnet');
  return { title: t('pageTitle') };
}

export default function AdminKamnetPage() {
  return (
    <PlaceholderPage
      namespace="app.adminKamnet"
      titleKey="pageTitle"
      subtitleKey="subtitle"
      features={[
        'Liste des agents KAMNET',
        'Gestion des niveaux (Junior, Confirmé, Manager)',
        'Validation des certifications KCA',
        'Statistiques du réseau',
      ]}
      roles={['ADMIN_KAMNET', 'ADMIN_GLOBAL', 'ROOT']}
    />
  );
}
