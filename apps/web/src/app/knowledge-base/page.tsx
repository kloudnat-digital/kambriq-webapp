import { useTranslations } from 'next-intl';

import Navbar from '@/components/layout/navbar';
import { KbContent } from '@/components/knowledge-base/kb-content';

const KbHero = () => {
  const t = useTranslations('knowledgeBase.hero');
  return (
    <section className="bg-gray-900 px-6 py-20 text-white sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="mb-4 text-4xl font-bold">{t('title')}</h1>
        <p className="text-gray-300">{t('subtitle')}</p>
      </div>
    </section>
  );
};

export default function KnowledgeBasePage() {
  return (
    <>
      <Navbar />
      <main className="pt-[73px]">
        <KbHero />
        <KbContent />
      </main>
    </>
  );
}
