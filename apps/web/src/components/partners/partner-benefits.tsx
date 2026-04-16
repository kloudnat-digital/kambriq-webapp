import { Globe, TrendingUp, Users, HeadphonesIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

const BENEFITS = [
  { icon: Globe, key: 'access', color: 'text-primary-600 bg-primary-500/10' },
  { icon: TrendingUp, key: 'revenue', color: 'text-gold-600 bg-gold-500/10' },
  { icon: Users, key: 'growth', color: 'text-accent-600 bg-accent-500/10' },
  { icon: HeadphonesIcon, key: 'support', color: 'text-success bg-success/10' },
];

export const PartnerBenefits = () => {
  const t = useTranslations('partners.benefits');
  return (
    <section className="px-6 py-20 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-center text-2xl font-bold">{t('title')}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, key, color }) => (
            <div
              key={key}
              className="rounded-2xl border border-border bg-white p-6 text-center shadow-sm"
            >
              <div
                className={`mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl ${color}`}
              >
                <Icon className="size-7" />
              </div>
              <h3 className="mb-2 font-semibold">{t(`items.${key}.title`)}</h3>
              <p className="text-sm text-gray-500">{t(`items.${key}.description`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
