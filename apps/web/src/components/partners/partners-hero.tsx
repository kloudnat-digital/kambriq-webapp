import { useTranslations } from 'next-intl';

export const PartnersHero = () => {
  const t = useTranslations('partners.hero');
  return (
    <section className="bg-gradient-to-br from-gray-900 via-primary-900 to-primary-800 px-6 py-24 text-white sm:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-4 text-sm font-medium tracking-widest text-primary-300 uppercase">
          {t('eyebrow')}
        </p>
        <h1 className="mb-6 text-4xl font-bold sm:text-5xl">{t('title')}</h1>
        <p className="text-lg text-primary-100">{t('subtitle')}</p>
      </div>
    </section>
  );
};
