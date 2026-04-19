import { CalendarRange, BookOpenCheck, Award, HatGlasses } from 'lucide-react';
import SectionHeader from '@/components/section/header';
import StepsContainer from '../../steps';
import Step from '../../steps/step';
import { getTranslations } from 'next-intl/server';

const ProcessFlow = async () => {
  const t = await getTranslations('products.kbs.process');
  const steps = [
    { Icon: CalendarRange, number: '01', titleKey: 'step1.title', descKey: 'step1.description' },
    { Icon: BookOpenCheck, number: '02', titleKey: 'step2.title', descKey: 'step2.description' },
    { Icon: Award, number: '03', titleKey: 'step3.title', descKey: 'step3.description' },
    { Icon: HatGlasses, number: '04', titleKey: 'step4.title', descKey: 'step4.description' },
  ] as const;

  return (
    <section className="bg relative overflow-hidden border-t border-border/45 py-20 md:py-28">
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />
        <StepsContainer>
          {steps.map(({ Icon, number, titleKey, descKey }, index) => (
            <Step
              key={number}
              Icon={Icon}
              stepLabel={number}
              isLast={index === steps.length - 1}
              title={t(titleKey)}
              description={t(descKey)}
            />
          ))}
        </StepsContainer>
      </div>
    </section>
  );
};

export default ProcessFlow;
