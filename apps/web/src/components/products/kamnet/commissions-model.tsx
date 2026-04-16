import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';

const TIERS = [
  { level: 'Junior', commission: '3%', color: 'border-gray-200 bg-gray-50' },
  { level: 'Senior', commission: '5%', color: 'border-primary-200 bg-primary-50' },
  { level: 'Expert', commission: '7%', color: 'border-gold-200 bg-gold-50' },
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
        <div className="grid gap-5 sm:grid-cols-3">
          {TIERS.map((tier) => (
            <div key={tier.level} className={`rounded-2xl border p-8 text-center ${tier.color}`}>
              <p className="mb-2 text-sm font-medium text-gray-500 uppercase">{tier.level}</p>
              <p className="text-4xl font-bold text-gray-900">{tier.commission}</p>
              <p className="mt-2 text-xs text-gray-500">{t('perSale')}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
