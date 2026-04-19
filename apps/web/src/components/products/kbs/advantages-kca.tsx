import SectionCard from '@/components/section/card';
import SectionCardContainer from '@/components/section/card/container';
import { Award, Orbit, Waypoints } from 'lucide-react';
import type { FC } from 'react';
import { getTranslations } from 'next-intl/server';

const AdvantagesKCA: FC = async () => {
  const t = await getTranslations('products.kbs.advantages');
  const advantages = [
    { Icon: Award, titleKey: 'recognition.title', descKey: 'recognition.description' },
    { Icon: Waypoints, titleKey: 'network.title', descKey: 'network.description' },
    { Icon: Orbit, titleKey: 'expertise.title', descKey: 'expertise.description' },
  ] as const;
  return (
    <div className="py-6">
      <p className="mx-auto max-w-lg text-center text-4xl font-semibold tracking-tight text-balance text-gray-950 sm:text-5xl">
        {t('heading')}
      </p>
      <SectionCardContainer
        className="mt-10 sm:mt-16 lg:mt-16 lg:max-w-5xl"
        containerClassName="lg:grid-cols-3"
      >
        {advantages.map(({ Icon, titleKey, descKey }) => (
          <SectionCard
            key={titleKey}
            Icon={Icon}
            title={t(titleKey)}
            description={t(descKey)}
            className="border-black/15 bg-white"
            iconClassName="text-gold-700"
            iconContainerClassName="bg-gold-50 border border-gold-600/20"
          />
        ))}
      </SectionCardContainer>
    </div>
  );
};

export default AdvantagesKCA;
