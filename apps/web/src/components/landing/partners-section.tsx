import { Scale, Compass, FileCheck, Building2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import SectionHeader from '@/components/section/header';
import SectionCardContainer from '../section/card/container';
import SectionCard from '../section/card';

const PartnersSection = async () => {
  const t = await getTranslations('partners');

  const partners = [
    { Icon: Scale, key: 'notaire' },
    { Icon: Compass, key: 'geometre' },
    { Icon: FileCheck, key: 'cadastre' },
    { Icon: Building2, key: 'institutions' },
  ] as const;

  return (
    <section className="bg-white py-20 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />
        <SectionCardContainer>
          {partners.map(({ Icon, key }) => (
            <SectionCard
              key={key}
              Icon={Icon}
              title={t(`${key}.title` as 'notaire.title')}
              description={t(`${key}.description` as 'notaire.description')}
            />
          ))}
        </SectionCardContainer>
      </div>
    </section>
  );
};

export default PartnersSection;
