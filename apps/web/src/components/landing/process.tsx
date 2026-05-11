import { getTranslations } from 'next-intl/server';
import { Search, CreditCard, FileCheck, Signature } from 'lucide-react';

import SectionHeader from '@/components/section/header';
import StepsContainer from '../steps';
import Step from '../steps/step';

const Process = async () => {
  const t = await getTranslations('process');

  const steps = [
    { Icon: Search, number: '01', key: 'step1' },
    { Icon: Signature, number: '02', key: 'step2' },
    { Icon: CreditCard, number: '03', key: 'step3' },
    { Icon: FileCheck, number: '04', key: 'step4' },
  ] as const;
  return (
    <section className="bg-surface-100 py-24 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t('eyebrow')}
          title={t('title')}
          subtitle={t('subtitle')}
          align="left"
          className="mx-auto max-w-3xl text-left"
        />

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
      </div>
    </section>
  );
};

export default Process;
