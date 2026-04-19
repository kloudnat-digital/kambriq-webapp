import SectionHeader from '@/components/section/header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Goal } from 'lucide-react';
import React from 'react';
import WhoCanRegisterKBS from './who-can register';
import AdvantagesKCA from './advantages-kca';
import { getTranslations } from 'next-intl/server';

const AboutKBS = async () => {
  const t = await getTranslations('products.kbs.about');
  return (
    <section className="relative overflow-hidden border-t border-border/45 bg-white py-20 md:py-28">
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />

        <div className="flex items-center justify-center py-10">
          <Alert className="max-w-4xl border-accent-600/20 bg-accent-50">
            <Goal className="size-5 text-accent-700!" />
            <AlertTitle className="text-lg text-accent-700">{t('missionLabel')}</AlertTitle>
            <AlertDescription className="text-base text-accent-700">
              {t('missionText')}
            </AlertDescription>
          </Alert>
        </div>

        <WhoCanRegisterKBS />
        <AdvantagesKCA />
      </div>
    </section>
  );
};

export default AboutKBS;
