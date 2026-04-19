import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

export async function generateMetadata() {
  const t = await getTranslations('app.profile');
  return { title: t('pageTitle') };
}

export default function ProfilePage() {
  return (
    <PlaceholderPage
      namespace="app.profile"
      titleKey="pageTitle"
      subtitleKey="subtitle"
      features={[
        'Informations personnelles (nom, email, téléphone)',
        'Photo de profil',
        'Changement de mot de passe',
        'Préférences de notification',
      ]}
      roles={['Tous les utilisateurs authentifiés']}
    />
  );
}
