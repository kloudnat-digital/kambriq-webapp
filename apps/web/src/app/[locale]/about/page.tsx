import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { publicPageMetadata } from '@/lib/seo/metadata';

import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import { AboutHero } from '@/components/about/about-hero';
import { CmsBody } from '@/components/cms/portable-text';
import { cmsLanguage, fetchContentPage } from '@/lib/cms/documents';

export const generateMetadata = (): Promise<Metadata> =>
  publicPageMetadata('/about', 'metadata.about');

export default async function AboutPage() {
  const locale = cmsLanguage(await getLocale());
  const document = await fetchContentPage('about', locale);

  // 404 rather than a hero with nothing under it: a page whose content is
  // missing has none, and a soft 404 over a 200 is indexed as a real page.
  if (!document) notFound();

  return (
    <>
      <Navbar />
      <main className="pt-[73px]">
        {/* Hero - short UI copy (eyebrow, title, subtitle) from next-intl JSON */}
        <AboutHero />

        {/* Long-form content, from the CMS */}
        <section className="px-6 py-20 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <CmsBody body={document.body} language={locale} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
