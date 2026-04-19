import { useTranslations } from 'next-intl';

import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import { FaqContent } from '@/components/faq/faq-content';

const FaqHero = () => {
  const t = useTranslations('faq.hero');
  return (
    <section className="bg-gray-900 px-6 py-20 text-white sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="mb-4 text-4xl font-bold">{t('title')}</h1>
        <p className="text-gray-300">{t('subtitle')}</p>
      </div>
    </section>
  );
};

export default function FaqPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[73px]">
        <FaqHero />
        <FaqContent />
      </main>
      <Footer />
    </>
  );
}
