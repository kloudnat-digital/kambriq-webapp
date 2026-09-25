import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import SectionHeader from '../section/header';

const LandingCta = async () => {
  const t = await getTranslations('homeCta');

  return (
    <section className="border-t border-border/45 py-20 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />
        <div className="mt-10 flex justify-center">
          <Button asChild size="lg" className="h-9">
            <Link href="/contact">{t('cta')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default LandingCta;
