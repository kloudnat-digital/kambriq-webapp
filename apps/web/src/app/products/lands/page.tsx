import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import QuickActions from '@/components/floating/quick-actions';
import Hero from '@/components/products/lands/hero';
import HowItWorks from '@/components/products/lands/how-it-works';
import LandTypes from '@/components/products/lands/land-types';
import WhyBuyAtKambriq from '@/components/products/lands/why-buy-at-kambriq';
import Footer from '@/components/layout/footer';
import Navbar from '@/components/layout/navbar';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.lands');
  return { title: t('title'), description: t('description') };
}

export default async function LandPage() {
  return (
    <>
      <Navbar />
      <main className="bg-white">
        <Hero />
        <LandTypes />
        <HowItWorks />
        <WhyBuyAtKambriq />
      </main>
      <Footer />
      <QuickActions />
    </>
  );
}
