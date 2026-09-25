import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo/metadata';
import QuickActions from '@/components/floating/quick-actions';
import Footer from '@/components/layout/footer';
import Navbar from '@/components/layout/navbar';
import Hero from '@/components/products/kamnet/hero';
import WhyKambriqAgent from '@/components/products/kamnet/why-kabriq-agent';
import WhyKamnetAgent from '@/components/products/kamnet/why-kamnet-agent';

export const generateMetadata = (): Promise<Metadata> =>
  publicPageMetadata('/products/kamnet', 'metadata.kamnet');

export default function KamnetPage() {
  return (
    <>
      <Navbar />
      <main className="bg-white">
        <Hero />
        <WhyKambriqAgent />
        <WhyKamnetAgent />
      </main>
      <Footer />
      <QuickActions />
    </>
  );
}
