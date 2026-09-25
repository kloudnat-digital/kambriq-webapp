import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';

import SectionHeader from '@/components/section/header';
import { Button } from '@/components/ui/button';

/**
 * P11 - the KAMNET product page points at KAMNET's only public surface.
 *
 * After the P9 arbitrage the directory is the whole of what KAMNET shows a
 * visitor, so a product page that never mentions it leaves the page with
 * nothing to send anybody to. The copy is about certification and
 * accompaniment and says nothing about what an agent earns - the P21 pin sweeps
 * `products.kamnet` for exactly that and would fail this file otherwise.
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
