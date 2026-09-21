import { GraduationCap, Headset, ShoppingBag } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

const FEATURE_KEYS = [
  { id: 'exclusiveAccess', Icon: ShoppingBag },
  { id: 'training', Icon: GraduationCap },
  { id: 'followUp', Icon: Headset },
  { id: 'career', Icon: Headset },
] as const;

const WhyKambriqAgent = async () => {
  const t = await getTranslations('products.kamnet.whyAgent');
  return (
    <section className="relative overflow-hidden border-t border-border/45 bg-white py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-5">
          <div className="col-span-2">
            <p className="text-4xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-5xl">
              {t('heading')}
            </p>
            <p className="mt-6 text-base/7 text-gray-700">{t('subheading')}</p>
          </div>
          <dl className="col-span-3 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2">
            {FEATURE_KEYS.map(({ id, Icon }) => (
              <div key={id}>
                <dt className="text-base/7 font-semibold text-gray-900">
                  <div className="mb-6 flex size-10 items-center justify-center rounded-lg bg-primary-600">
                    <Icon className="size-5 text-white" />
                  </div>
                  {t(`${id}.title`)}
                </dt>
                <dd className="mt-1 text-base/7 text-gray-600">{t(`${id}.description`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
};

export default WhyKambriqAgent;
