import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import QuickActions from '@/components/floating/quick-actions';
import { getLocale, getTranslations } from 'next-intl/server';
import { loadContent } from '@/lib/content';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default async function PlanPage() {
  const locale = await getLocale();
  const t = await getTranslations('plan');
  const PlanContent = await loadContent('plan', locale);

  return (
    <>
      <Navbar />
      <main className="bg-white pt-[73px]">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-6 py-16 sm:px-8 sm:py-24">
          <p className="text-sm font-semibold tracking-widest text-primary uppercase">
            {t('eyebrow')}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mt-6 text-lg/8 text-gray-600">{t('subtitle')}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button asChild size="lg" className="h-9">
              <Link href="/contact">{t('cta')}</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="h-9 font-semibold text-gray-900 hover:bg-transparent hover:text-gray-900"
            >
              <Link href="/products/lands">
                {t('cta2')} <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>

        {/* MDX content */}
        <section className="border-t border-border/45 px-6 py-16 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <PlanContent />
          </div>
        </section>
      </main>
      <Footer />
      <QuickActions />
    </>
  );
}
