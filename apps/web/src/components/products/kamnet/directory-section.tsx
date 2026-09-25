import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

import SectionHeader from '@/components/section/header';
import { Button } from '@/components/ui/button';

/**
 * P11 - Renders the KAMNET public directory entry point on the product page.
 *
 * Ensures visitors have a direct path to the directory, KAMNET's sole public surface.
 * Copy strictly focuses on certification and accompaniment. References to agent earnings
 * are omitted to comply with P21 pin sweeps.
 */
const DirectorySection = async () => {
  const t = await getTranslations('products.kamnet.directory');

  return (
    <section className="border-t border-border/45 px-6 py-20 sm:px-8">
      <div className="container mx-auto">
        <SectionHeader title={t('sectionTitle')} subtitle={t('sectionDescription')} />
        <div className="mt-10 flex justify-center">
          <Button asChild size="lg" className="h-9">
            <Link href="/products/kamnet/annuaire">
              <ShieldCheck className="mr-1 size-4" />
              {t('sectionCta')}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default DirectorySection;
