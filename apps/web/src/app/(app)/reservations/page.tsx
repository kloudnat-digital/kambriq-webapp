import { getTranslations } from 'next-intl/server';
import { ReservationsContent } from '@/components/reservations/reservations-content';

export async function generateMetadata() {
  const t = await getTranslations('app.reservations');
  return { title: t('pageTitle') };
}

export default async function ReservationsPage() {
  const t = await getTranslations('app.reservations');
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('pageSubtitle')}</p>
      </div>
      <ReservationsContent />
    </div>
  );
}
