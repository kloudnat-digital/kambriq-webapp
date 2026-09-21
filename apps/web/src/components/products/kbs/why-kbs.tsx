import SectionCard from '@/components/section/card';
import SectionCardContainer from '@/components/section/card/container';
import SectionHeader from '@/components/section/header';
import { Headset, HeartHandshake, Waypoints } from 'lucide-react';
import React from 'react';
import { getTranslations } from 'next-intl/server';

const WhyKBS = async () => {
  const t = await getTranslations('products.kbs.whyKbs');
  const features = [
    { Icon: Waypoints, titleKey: 'network.title', descKey: 'network.description' },
    { Icon: HeartHandshake, titleKey: 'expertise.title', descKey: 'expertise.description' },
    { Icon: Headset, titleKey: 'support.title', descKey: 'support.description' },
  ] as const;

  return (
    <section className="border-t border-border/45 bg-background py-20 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />
        <SectionCardContainer>
          {features.map(({ Icon, titleKey, descKey }) => (
            <SectionCard key={titleKey} Icon={Icon} title={t(titleKey)} description={t(descKey)} />
          ))}
        </SectionCardContainer>
      </div>
    </section>
  );
};

export default WhyKBS;
