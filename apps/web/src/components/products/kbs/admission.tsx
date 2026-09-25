import SectionHeader from '@/components/section/header';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

const Admission = async () => {
  const t = await getTranslations('products.kbs.admission');
  const conditions = [
    { id: 'sponsorship', key: 'sponsorship' },
    { id: 'free-application', key: 'freeApplication' },
  ] as const;

  return (
    <section className="border-t border-border/45 bg-background py-20 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />

        <div className="mx-auto mt-10 grid max-w-md grid-cols-1 gap-8 lg:max-w-4xl lg:grid-cols-2">
          {conditions.map((condition) => (
            <div
              key={condition.id}
              className="flex flex-col justify-between rounded-lg bg-white p-8 shadow-xs outline outline-gray-900/10 sm:p-10"
            >
              <div>
                <h3 id={condition.id} className="text-base/7 font-semibold text-primary-500">
                  {t(`${condition.key}.name`)}
                </h3>
                <div className="mt-4">
                  <p className="text-3xl font-semibold tracking-tight text-gray-900">
                    {t(`${condition.key}.title`)}
                  </p>
                </div>
                <p className="mt-2 text-base/7 text-gray-600">
                  {t(`${condition.key}.description`)}
                </p>
              </div>
            </div>
          ))}
          <div className="flex flex-col items-start gap-x-8 gap-y-6 rounded-3xl p-8 ring-1 ring-gray-900/10 sm:gap-y-10 sm:p-10 lg:col-span-2 lg:flex-row lg:items-center">
            <div className="lg:min-w-0 lg:flex-1">
              <h3 className="text-base/7 font-semibold text-primary-600">{t('pricing.label')}</h3>
              <p className="mt-1 text-base/7 text-gray-600">{t('pricing.description')}</p>
              <div className="mt-4 flex items-baseline gap-x-2">
                <span className="text-5xl font-semibold tracking-tight text-gray-900">
                  {t('pricing.price')}
                </span>
                <span className="text-base/7 font-semibold text-gray-600">{t('pricing.tax')}</span>
              </div>
            </div>
            <Button asChild variant="outline" size="lg" className="h-9 font-semibold">
              <Link href="/kbs/enroll">
                {t('pricing.cta')} <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Admission;
