import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

export async function generateMetadata() {
  const t = await getTranslations('app.agentDashboard');
  return { title: t('title') };
}

export default function AgentDashboardPage() {
  return <PlaceholderPage namespace="app.agentDashboard" titleKey="title" />;
}
