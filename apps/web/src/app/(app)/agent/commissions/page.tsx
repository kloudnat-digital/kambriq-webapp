import { RoleCode } from '@/lib/roles';
import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

export async function generateMetadata() {
  const t = await getTranslations('app.commissions');
  return { title: t('pageTitle') };
}

export default function CommissionsPage() {
  return (
    <PlaceholderPage
      namespace="app.commissions"
      titleKey="pageTitle"
      subtitleKey="subtitle"
      features={[
        'Tableau des commissions par période',
        'Détail par transaction',
        'Historique des paiements',
        'Export des relevés',
      ]}
      roles={[RoleCode.AGENT, 'OPS', RoleCode.ADMIN_GLOBAL, 'ROOT']}
    />
  );
}
