import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { siteConfig } from '@/config/site.config';
import { Button } from '@/components/ui/button';
import SectionHeader from '../section/header';

const LandingCta = async () => {
  const t = await getTranslations('homeCta');
  const whatsappHref = `https://wa.me/${siteConfig.contact.whatsapp.number.replace(/[^0-9]/g, '')}`;

  return (
    <section className="border-t border-border/45 py-20 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />
        <div className="mt-10 flex justify-center">
          <Button asChild size="lg" className="h-9">
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
