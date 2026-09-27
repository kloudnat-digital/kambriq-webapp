import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import QuickActions from '@/components/floating/quick-actions';
import { getLocale, getTranslations } from 'next-intl/server';
import { publicPageMetadata } from '@/lib/seo/metadata';
import { CmsBody } from '@/components/cms/portable-text';
import { cmsLanguage, fetchContentPage } from '@/lib/cms/documents';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ArrowRight } from 'lucide-react';

export const generateMetadata = (): Promise<Metadata> =>
  publicPageMetadata('/methode', 'metadata.methode');

export default async function MethodePage() {
  const locale = cmsLanguage(await getLocale());
  const t = await getTranslations('methode');
  const document = await fetchContentPage('methode', locale);

  // 404 rather than a hero with nothing under it: a page whose content is
  // missing has none, and a soft 404 over a 200 is indexed as a real page.
  if (!document) notFound();

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

        {/* Long-form content, from the CMS */}
        <section className="border-t border-border/45 px-6 py-16 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <CmsBody body={document.body} language={locale} />
          </div>
        </section>
      </main>
      <Footer />
      <QuickActions />
    </>
  );
}
