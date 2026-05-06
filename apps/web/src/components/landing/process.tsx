import { getTranslations } from 'next-intl/server';

import SectionHeader from '@/components/section/header';

const Process = async () => {
  const t = await getTranslations('process');

  const steps = [
    { number: '01', key: 'step1' },
    { number: '02', key: 'step2' },
    { number: '03', key: 'step3' },
    { number: '04', key: 'step4' },
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

<<<<<<< HEAD
        <div className="mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ number, key }) => (
            <div key={key} className="relative">
              <div className="font-serif text-7xl leading-none font-medium text-gold italic opacity-90">
                {number}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-accent">
                {t(`${key}.title` as 'step1.title')}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-surface-600">
                {t(`${key}.description` as 'step1.description')}
              </p>
            </div>
=======
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
>>>>>>> c0c6b1f (feat(lands): update auth, enforce reservation ownership, fix admin stats)
          ))}
        </div>
      </div>
    </section>
  );
};

export default Process;
