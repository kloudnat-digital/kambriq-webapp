import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import QuickActions from '@/components/floating/quick-actions';
import Footer from '@/components/layout/footer';
import Navbar from '@/components/layout/navbar';
import AboutKBS from '@/components/products/kbs/about';
import Admission from '@/components/products/kbs/admission';
import Hero from '@/components/products/kbs/hero';
import ProcessFlow from '@/components/products/kbs/process-flow';
import ProgramAndModules from '@/components/products/kbs/progam-and-modules';
import WhatYouWillLearn from '@/components/products/kbs/what-you-will-learn';
import WhyKBS from '@/components/products/kbs/why-kbs';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.kbs');
  return { title: t('title'), description: t('description') };
}

export default function KbsPage() {
  return (
    <>
      <Navbar />
      <main className="bg-white">
        <Hero />
        <AboutKBS />
        <WhyKBS />
        <WhatYouWillLearn />
        <ProgramAndModules />
        <ProcessFlow />
        <Admission />
      </main>
      <Footer />
      <QuickActions />
    </>
  );
}
