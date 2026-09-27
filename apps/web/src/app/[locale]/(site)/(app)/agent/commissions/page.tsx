import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

export async function generateMetadata() {
  const t = await getTranslations('app.commissions');
  return { title: t('pageTitle') };
}

export default function CommissionsPage() {
  return <PlaceholderPage namespace="app.commissions" titleKey="pageTitle" />;
}
