import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';

const LandingCta = async () => {
  const t = await getTranslations('homeCta');

  return (
    <section className="bg-card py-20 md:py-28">
      <div className="mx-auto max-w-2xl px-6 text-center lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
          {t('title')}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg/8 text-gray-600">{t('subtitle')}</p>
        <div className="mt-10">
          <Button asChild size="lg">
            <Link href="/contact">{t('cta')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default LandingCta;
