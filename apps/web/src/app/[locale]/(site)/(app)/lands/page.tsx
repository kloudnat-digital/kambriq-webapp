import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import LandsCatalogContent from '@/components/lands/app/lands-catalog-content';
import { isAdminLands } from '@/routes';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app.landsPage');
  return { title: t('title') };
}

export default async function LandsPage() {
  const [t, session] = await Promise.all([getTranslations('app.landsPage'), auth()]);
  const isAdmin = isAdminLands(session?.user?.roles ?? []);

  return (
    <div className="h-full p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
      </div>
      <LandsCatalogContent isAdmin={isAdmin} />
    </div>
  );
}
