import { getTranslations } from 'next-intl/server';
import { PlaceholderPage } from '@/components/placeholder-page';

export async function generateMetadata() {
  const t = await getTranslations('app.adminReservations');
  return { title: t('pageTitle') };
}

export default function AdminReservationsPage() {
  return <PlaceholderPage namespace="app.adminReservations" titleKey="pageTitle" />;
}
