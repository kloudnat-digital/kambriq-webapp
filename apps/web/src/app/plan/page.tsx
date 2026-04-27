import type { Metadata } from 'next';
import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import QuickActions from '@/components/floating/quick-actions';
import { getLocale, getTranslations } from 'next-intl/server';
import { loadContent } from '@/lib/content';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.plan');
  return { title: t('title'), description: t('description') };
}

export default async function PlanPage() {
  const locale = await getLocale();
  const t = await getTranslations('plan');
  const PlanContent = await loadContent('plan', locale);

  return (
    <>
      <Navbar />
      <main className="bg-white">
        {/* Hero */}
        <section className="bg-surface-100">
          <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8 sm:py-24">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
              {t('eyebrow')}
            </p>
            <h1 className="mt-4 font-serif text-4xl leading-[1.05] font-semibold tracking-[-0.02em] text-pretty text-accent sm:text-5xl">
              {t('title')}
            </h1>
            <p className="mt-5 text-lg leading-[1.65] text-surface-600">{t('subtitle')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/contact">{t('cta')}</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/products/lands">
                  {t('cta2')} <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* MDX content */}
        <section className="border-t border-border px-6 py-20 sm:px-8 sm:py-24">
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
