import { getTranslations } from 'next-intl/server';
import { MyLandsContent } from '@/components/mylands/mylands-content';

export default async function MyLandsPage() {
  const t = await getTranslations('app.myLands');

  return (
    <div className="h-full p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
      </div>
      <MyLandsContent />
    </div>
  );
}
