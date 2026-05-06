import { Headset, SearchCheck, ShieldCheck, FileBadge } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import SectionHeader from '@/components/section/header';
import StepsContainer from '../../steps';
import Step from '../../steps/step';

const HowItWorks = async () => {
  const t = await getTranslations('howItWorks');

  const steps = [
    { Icon: Headset, number: '01', key: 'step1' },
    { Icon: SearchCheck, number: '02', key: 'step2' },
    { Icon: ShieldCheck, number: '03', key: 'step3' },
    { Icon: FileBadge, number: '04', key: 'step4' },
  ] as const;

  return (
    <section className="relative overflow-hidden border-t border-border/45 bg-background py-20 md:py-28">
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />
        <StepsContainer>
          {steps.map(({ Icon, number, key }) => (
            <Step
              key={key}
              Icon={Icon}
              stepLabel={number}
              title={t(`${key}.title` as 'step1.title')}
              description={t(`${key}.description` as 'step1.description')}
            />
          ))}
        </StepsContainer>
      </div>
    </section>
  );
};

export default HowItWorks;
