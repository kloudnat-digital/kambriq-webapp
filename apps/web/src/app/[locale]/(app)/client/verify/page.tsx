import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

export async function generateMetadata() {
  const t = await getTranslations('app.clientVerify');
  return { title: t('pageTitle') };
}

export default function ClientVerifyPage() {
  return <PlaceholderPage namespace="app.clientVerify" titleKey="pageTitle" />;
}
