import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';

const COMMISSION_TYPES = [
  {
    labelKey: 'saleLabel',
    rate: '3%',
    detailKey: 'saleDetail',
    color: 'border-primary-200 bg-primary-50',
  },
  {
    labelKey: 'reservationLabel',
    rate: '1%',
    detailKey: 'reservationDetail',
    color: 'border-gray-200 bg-gray-50',
  },
];

export const CommissionsModel = () => {
  const t = useTranslations('products.kamnet.commissions');
  return (
    <section className="bg-gray-50 px-6 py-20 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-center gap-2">
          <TrendingUp className="size-6 text-primary-600" />
          <h2 className="text-2xl font-bold">{t('title')}</h2>
        </div>
        <p className="mb-12 text-center text-gray-500">{t('subtitle')}</p>
        <div className="grid gap-5 sm:grid-cols-2">
          {COMMISSION_TYPES.map((item) => (
            <div key={item.labelKey} className={`rounded-2xl border p-8 text-center ${item.color}`}>
              <p className="mb-2 text-sm font-medium text-gray-500 uppercase">{t(item.labelKey)}</p>
              <p className="text-4xl font-bold text-gray-900">{item.rate}</p>
              <p className="mt-2 text-xs text-gray-500">{t(item.detailKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
