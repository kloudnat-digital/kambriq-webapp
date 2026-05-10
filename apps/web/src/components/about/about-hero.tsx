import { useTranslations } from 'next-intl';

import Eyebrow from '@/components/ui/eyebrow';

export const AboutHero = () => {
  const t = useTranslations('about');
  return (
    <section className="relative overflow-hidden bg-accent px-6 py-24 text-white sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(240, 188, 49, 0.10), transparent 60%)',
        }}
      />
      <div className="relative mx-auto max-w-4xl text-center">
        <Eyebrow tone="gold" className="flex justify-center">
          {t('hero.eyebrow')}
        </Eyebrow>
        <h1 className="mt-4 font-serif text-4xl leading-[1.05] font-semibold tracking-[-0.02em] text-white sm:text-5xl md:text-6xl">
          {t('hero.title')}
        </h1>
        <p className="mt-5 text-lg leading-[1.65] text-accent-200">{t('hero.subtitle')}</p>
      </div>
    </section>
  );
};
