import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

export async function generateMetadata() {
  const t = await getTranslations('app.enroll');
  return { title: t('pageTitle') };
}

export default function KbsEnrollPage() {
  return (
    <PlaceholderPage
      namespace="app.enroll"
      titleKey="pageTitle"
      subtitleKey="subtitle"
      features={[
        'Formulaire de candidature',
        "Choix du mode d'admission (parrainage ou libre)",
        'Code parrain (si applicable)',
        'Paiement de la formation (249\u00A0\u20AC TTC)',
      ]}
      roles={['Tous les utilisateurs authentifiés']}
    />
  );
}
