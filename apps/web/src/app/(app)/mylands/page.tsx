import { getTranslations } from 'next-intl/server';
import { MyLandsContent } from '@/components/mylands/mylands-content';

export default async function MyLandsPage() {
  const t = await getTranslations('app.myLands');
  return (
    <div className="p-6 lg:p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
      <MyLandsContent />
    </div>
  );
}
