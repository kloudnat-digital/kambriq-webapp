import type { Metadata } from 'next';
import Navbar from '@/components/layout/navbar';
import HowItWorks from '@/components/products/verify/how-it-works';
import QuickActions from '@/components/floating/quick-actions';
import Footer from '@/components/layout/footer';
import Hero from '@/components/products/verify/hero';
import VerifyFAQ from '@/components/products/verify/faq';
import ReadyToVerify from '@/components/products/verify/ready-to-verify';
import { getLocale, getTranslations } from 'next-intl/server';
import { loadContent } from '@/lib/content';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.verify');
  return { title: t('title'), description: t('description') };
}

export default async function VerifyPage() {
  const locale = await getLocale();
  const VerifyContent = await loadContent('verify', locale);

  return (
    <>
      <Navbar />
      <main className="bg-white">
        <Hero />
        <section className="border-t border-border/45 px-6 py-16 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <VerifyContent />
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
