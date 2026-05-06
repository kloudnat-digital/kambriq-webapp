import SectionHeader from '@/components/section/header';
import { cn } from '@/lib/utils';
import React from 'react';
import { getTranslations } from 'next-intl/server';

const STEP_KEYS = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7'] as const;

const WhyKamnetAgent = async () => {
  const t = await getTranslations('products.kamnet.agentJourney');
  return (
    <section className="border-t border-border/45 bg-background py-20 md:py-28">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />

        <div className="mx-auto mt-10">
          <ul className="space-y-6">
            {STEP_KEYS.map((key, index) => (
              <li key={key} className="relative flex gap-x-4">
                <div
                  className={cn(
                    index === STEP_KEYS.length - 1 ? 'h-6' : '-bottom-6',
                    'absolute top-0 left-0 flex w-8 justify-center',
                  )}
                >
                  <div className="w-px bg-accent-200" />
                </div>
                <div className="relative flex size-8 flex-none items-center justify-center bg-white">
                  <span className="flex size-6 items-center justify-center rounded-full bg-accent-700 text-accent-200 outline outline-accent-500">
                    <span>{index + 1}</span>
                  </span>
                </div>
                <div className="flex-auto rounded-lg p-3 ring-1 ring-gray-200 ring-inset">
                  <div className="py-0.5 text-sm/5 font-medium text-gray-900">
                    {t(`${key}.title`)}
                  </div>
                  <p className="text-sm/6 text-gray-500">{t(`${key}.description`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default WhyKamnetAgent;
