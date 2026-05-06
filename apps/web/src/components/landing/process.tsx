import { Search, CreditCard, FileCheck, Signature } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import SectionHeader from '@/components/section/header';
import Step from '../steps/step';
import StepsContainer from '../steps';

const Process = async () => {
  const t = await getTranslations('process');

  const steps = [
    { Icon: Search, number: '01', key: 'step1' },
    { Icon: Signature, number: '02', key: 'step2' },
    { Icon: CreditCard, number: '03', key: 'step3' },
    { Icon: FileCheck, number: '04', key: 'step4' },
  ] as const;

  return (
    <section className="relative overflow-hidden bg-card py-20 md:py-28">
      <div className="pointer-events-none absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-primary blur-3xl" />
        <div className="absolute right-10 bottom-20 h-96 w-96 rounded-full bg-accent blur-3xl" />
      </div>

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

export default Process;
