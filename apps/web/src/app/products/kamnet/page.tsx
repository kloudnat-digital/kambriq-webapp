import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import QuickActions from '@/components/floating/quick-actions';
import Footer from '@/components/layout/footer';
import Navbar from '@/components/layout/navbar';
import DirectorySection from '@/components/products/kamnet/directory-section';
import Hero from '@/components/products/kamnet/hero';
import WhyKambriqAgent from '@/components/products/kamnet/why-kabriq-agent';
import WhyKamnetAgent from '@/components/products/kamnet/why-kamnet-agent';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.kamnet');
  return { title: t('title'), description: t('description') };
}

export default function KamnetPage() {
  return (
    <>
      <Navbar />
      <main className="bg-white">
        <Hero />
        <WhyKambriqAgent />
        <WhyKamnetAgent />
        <DirectorySection />
      </main>
      <Footer />
      <QuickActions />
    </>
  );
}
