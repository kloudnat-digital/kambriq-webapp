import { getTranslations } from 'next-intl/server';

import SectionHeader from '@/components/section/header';
import Eyebrow from '@/components/ui/eyebrow';

const WhyKambriq = async () => {
  const t = await getTranslations('why');

  const features = [
    { eyebrowKey: 'method', titleKey: 'verification' },
    { eyebrowKey: 'support', titleKey: 'support' },
    { eyebrowKey: 'transparency', titleKey: 'transparency' },
    { eyebrowKey: 'distance', titleKey: 'distance' },
  ] as const;

  return (
    <section className="bg-white py-24 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow={t('eyebrow')}
          title={t('title')}
          subtitle={t('lead')}
          align="left"
          className="mx-auto max-w-3xl text-left"
        />

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map(({ eyebrowKey, titleKey }) => (
            <div
              key={titleKey}
              className="rounded-xl border border-border bg-white p-6 shadow-card transition-shadow hover:shadow-hover"
              style={{ borderTop: '2px solid var(--color-gold)' }}
            >
              <Eyebrow>{t(`eyebrows.${eyebrowKey}` as 'eyebrows.method')}</Eyebrow>
              <h3 className="mt-4 font-serif text-2xl leading-[1.15] font-semibold text-accent">
                {t(`${titleKey}.title` as 'verification.title')}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-surface-600">
                {t(`${titleKey}.description` as 'verification.description')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyKambriq;
