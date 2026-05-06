import { Shield, Lock, Zap, Network } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import SectionHeader from '@/components/section/header';

const WhyKambriq = async () => {
  const t = await getTranslations('why');

  const features = [
    { Icon: Shield, titleKey: 'verification', descKey: 'verification' },
    { Icon: Lock, titleKey: 'transparency', descKey: 'transparency' },
    { Icon: Zap, titleKey: 'support', descKey: 'support' },
    { Icon: Network, titleKey: 'distance', descKey: 'distance' },
  ] as const;
  return (
    <section className="bg-white py-24 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t('eyebrow')}
          title={t('title')}
          subtitle={t('lead')}
          align="left"
          className="mx-auto max-w-3xl text-left"
        />

        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
          <div className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
            {features.map(({ Icon, titleKey, descKey }) => (
              <div key={titleKey} className="relative pl-16">
                <div className="text-base/7 font-semibold text-gray-900">
                  <div className="absolute top-0 left-0 flex size-10 items-center justify-center rounded-md bg-primary">
                    <Icon className="size-6 text-background" />
                  </div>
                  {t(`${titleKey}.title` as `verification.title`)}
                </div>
                <div className="mt-2 text-base/7 text-gray-600">
                  {t(`${descKey}.description` as `verification.description`)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyKambriq;
