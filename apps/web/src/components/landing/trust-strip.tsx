import { getTranslations } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';

const TrustStrip = async () => {
  const t = await getTranslations('trustStrip');

  return (
    <section className="bg-[var(--color-cream-warm)] py-6">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-x-10 gap-y-4 px-4 sm:px-6 lg:px-8">
        <p className="text-sm text-surface-700">
          {t('lead')} <strong className="font-semibold text-accent">{t('emphasis')}</strong>
          {t('tail')}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="tfl">KAMBRIQ TFL™</Badge>
          <Badge variant="vefl">KAMBRIQ VEFL™</Badge>
          <Badge variant="vefil">KAMBRIQ VEFIL™</Badge>
        </div>
      </div>
    </section>
  );
};

export default TrustStrip;
