import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

export async function generateMetadata() {
  const t = await getTranslations('app.escalation');
  return { title: t('pageTitle') };
}

export default function EscalationNewPage() {
  return <PlaceholderPage namespace="app.escalation" titleKey="pageTitle" />;
}
