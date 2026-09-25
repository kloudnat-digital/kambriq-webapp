import { getTranslations } from 'next-intl/server';

export async function AboutHero() {
  const t = await getTranslations('about');
  return (
    <section className="bg-gradient-to-b from-primary-900 to-primary-800 px-6 py-24 text-white sm:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <p className="mb-4 text-sm font-medium tracking-widest text-primary-300 uppercase">
          {t('hero.eyebrow')}
        </p>
        <h1 className="mb-6 text-4xl font-bold sm:text-5xl">{t('hero.title')}</h1>
        <p className="text-lg leading-relaxed text-primary-100">{t('hero.subtitle')}</p>
      </div>
    </section>
  );
}
