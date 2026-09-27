import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Navbar from '@/components/layout/navbar';
import HowItWorks from '@/components/products/verify/how-it-works';
import QuickActions from '@/components/floating/quick-actions';
import Footer from '@/components/layout/footer';
import Hero from '@/components/products/verify/hero';
import VerifyFAQ from '@/components/products/verify/faq';
import ReadyToVerify from '@/components/products/verify/ready-to-verify';
import { getLocale } from 'next-intl/server';
import { publicPageMetadata } from '@/lib/seo/metadata';
import { CmsBody } from '@/components/cms/portable-text';
import { cmsLanguage, fetchContentPage } from '@/lib/cms/documents';

export const generateMetadata = (): Promise<Metadata> =>
  publicPageMetadata('/products/verify', 'metadata.verify');

export default async function VerifyPage() {
  const locale = cmsLanguage(await getLocale());
  const document = await fetchContentPage('verify', locale);

  // 404 rather than a hero with nothing under it: a page whose content is
  // missing has none, and a soft 404 over a 200 is indexed as a real page.
  if (!document) notFound();

  return (
    <>
      <Navbar />
      <main className="bg-white">
        <Hero />
        <section className="border-t border-border/45 px-6 py-16 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <CmsBody body={document.body} language={locale} />
          </div>
        </section>
        <HowItWorks />
        <VerifyFAQ />
        <ReadyToVerify />
      </main>
      <Footer />
      <QuickActions />
    </>
  );
}
