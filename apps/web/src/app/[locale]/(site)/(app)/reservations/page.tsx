import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import ReservationsContent from '@/components/reservations/reservations-content';
import { isAdminLands } from '@/routes';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app.reservations');
  return { title: t('pageTitle') };
}

export default async function ReservationsPage() {
  const [t, session] = await Promise.all([getTranslations('app.reservations'), auth()]);
  const isAdmin = isAdminLands(session?.user?.roles ?? []);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('pageSubtitle')}</p>
      </div>
      <ReservationsContent isAdmin={isAdmin} />
    </div>
  );
}
