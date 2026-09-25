import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

export async function generateMetadata() {
  const t = await getTranslations('app.welcome');
  return { title: t('pageTitle') };
}

export default function WelcomePage() {
  return (
    <PlaceholderPage
      namespace="app.welcome"
      titleKey="pageTitle"
      subtitleKey="subtitle"
      features={[
        'Onboarding personnalisé selon le rôle',
        'Présentation des fonctionnalités disponibles',
        'Liens rapides vers les sections principales',
      ]}
      roles={['Tous les utilisateurs authentifiés']}
    />
  );
}
