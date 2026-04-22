import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import { AboutHero } from '@/components/about/about-hero';
import { loadContent } from '@/lib/content';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.about');
  return { title: t('title'), description: t('description') };
}

export default async function AboutPage() {
  const locale = await getLocale();
  const AboutContent = await loadContent('about', locale);

  return (
    <>
      <Navbar />
      <main className="pt-[73px]">
        {/* Hero — short UI copy (eyebrow, title, subtitle) from next-intl JSON */}
        <AboutHero />

        {/*
         * Content — long-form narrative from MDX.
         * Edit:  apps/web/src/content/about/en.mdx  (English)
         *        apps/web/src/content/about/fr.mdx  (French)
         * Style: apps/web/mdx-components.tsx
         */}
        <section className="px-6 py-20 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <AboutContent />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
