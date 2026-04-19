import { getTranslations } from 'next-intl/server';
import { LandsCatalogContent } from '@/components/lands/app/lands-catalog-content';

export async function generateMetadata() {
  const t = await getTranslations('app.landsPage');
  return { title: t('title') };
}

export default async function LandsPage() {
  const t = await getTranslations('app.landsPage');
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
      </div>
      <LandsCatalogContent />
    </div>
  );
}
