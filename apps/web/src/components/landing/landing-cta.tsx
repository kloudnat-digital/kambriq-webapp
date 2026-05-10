import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { siteConfig } from '@/config/site.config';
import { Button } from '@/components/ui/button';

const LandingCta = async () => {
  const t = await getTranslations('homeCta');
  const whatsappHref = `https://wa.me/${siteConfig.contact.whatsapp.number.replace(/[^0-9]/g, '')}`;

  return (
    <section className="bg-white py-28 md:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
        <h2 className="font-serif text-4xl leading-[1.05] font-semibold tracking-[-0.015em] text-pretty text-accent sm:text-5xl">
          {t('titleLead')} <em className="font-medium text-primary">{t('titleEm')}</em>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-[1.65] text-surface-600">
          {t('subtitle')}
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/contact">{t('cta')}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={whatsappHref} target="_blank" rel="noopener noreferrer">
              WhatsApp {siteConfig.contact.whatsapp.displayNumber}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default LandingCta;
