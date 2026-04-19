import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

export async function generateMetadata() {
  const t = await getTranslations('app.settings');
  return { title: t('pageTitle') };
}

export default function SettingsPage() {
  return (
    <PlaceholderPage
      namespace="app.settings"
      titleKey="pageTitle"
      subtitleKey="subtitle"
      features={[
        'Configuration des rôles et permissions',
        'Paramètres de la plateforme',
        'Gestion des intégrations',
      ]}
      roles={['ADMIN_GLOBAL', 'ROOT']}
    />
  );
}
