import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { publicPageMetadata } from '@/lib/seo/metadata';
import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import Hero from '@/components/landing/hero';
import WhyKambriq from '@/components/landing/why-kambriq';
import Process from '@/components/landing/process';
import ProductsServices from '@/components/landing/products-services';
import LandingCta from '@/components/landing/landing-cta';

const QuickActions = dynamic(() => import('@/components/floating/quick-actions'));

export const generateMetadata = (): Promise<Metadata> => publicPageMetadata('/', 'metadata.home');

export default async function HomePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <Hero />
        <WhyKambriq />
        <Process />
        <ProductsServices />
        <LandingCta />
      </main>
      <Footer />
      <QuickActions />
    </>
  );
}
