import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

export async function generateMetadata() {
  const t = await getTranslations('app.agentDashboard');
  return { title: t('title') };
}

export default function AgentDashboardPage() {
  return (
    <PlaceholderPage
      namespace="app.agentDashboard"
      titleKey="title"
      subtitleKey="welcome"
      features={[
        'Statistiques de ventes et commissions',
        'Pipeline de vente (contacts → vendu)',
        'Clients récents',
        'Graphique des commissions (6 derniers mois)',
      ]}
      roles={['AGENT', 'OPS', 'ADMIN_GLOBAL', 'ROOT']}
    />
  );
}
