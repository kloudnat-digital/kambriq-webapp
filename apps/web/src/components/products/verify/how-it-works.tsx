import { FileText, Search, FileCheck, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import SectionHeader from '@/components/section/header';
import StepsContainer from '../../steps';
import Step from '../../steps/step';

const HowItWorks = () => {
  const t = useTranslations('products.verify.howItWorks');

  const steps = [
    { Icon: FileText, number: '01', key: 'step1' },
    { Icon: Search, number: '02', key: 'step2' },
    { Icon: FileCheck, number: '03', key: 'step3' },
    { Icon: Send, number: '04', key: 'step4' },
  ] as const;

  return (
    <section className="relative overflow-hidden border-t border-border/45 bg-background py-20 md:py-28">
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title={t('title')}
          subtitle={
            "Un processus simple et transparent pour vérifier l'authenticité de votre terrain en 4 étapes."
          }
        />
        <StepsContainer>
          {steps.map(({ Icon, number, key }, index) => (
            <Step
              key={key}
              Icon={Icon}
              stepLabel={number}
              isLast={index === steps.length - 1}
              title={t(`steps.${index}.title`)}
              description={t(`steps.${index}.description`)}
            />
          ))}
        </StepsContainer>
      </div>
    </section>
  );
};

export default HowItWorks;
