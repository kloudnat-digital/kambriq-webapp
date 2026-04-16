import { useTranslations } from 'next-intl';

import Navbar from '@/components/layout/navbar';
import { HelpContent } from '@/components/help/help-content';

const HelpHero = () => {
  const t = useTranslations('help.hero');
  return (
    <section className="bg-gradient-to-br from-primary-700 to-primary-900 px-6 py-20 text-white sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="mb-4 text-4xl font-bold">{t('title')}</h1>
        <p className="text-primary-100">{t('subtitle')}</p>
      </div>
    </section>
  );
};

export default function HelpPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[73px]">
        <HelpHero />
        <HelpContent />
      </main>
    </>
  );
}
