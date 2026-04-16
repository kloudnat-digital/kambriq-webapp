import dynamic from 'next/dynamic';
import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import Hero from '@/components/landing/hero';
import WhyKambriq from '@/components/landing/why-kambriq';
import Process from '@/components/landing/process';
import ProductsServices from '@/components/landing/products-services';
import DiasporaBanner from '@/components/landing/diaspora-banner';

const PartnersSection = dynamic(() => import('@/components/landing/partners-section'));
const Testimonials = dynamic(() => import('@/components/landing/testimonials'));
const FAQ = dynamic(() => import('@/components/landing/faq'));
const QuickActions = dynamic(() => import('@/components/floating/quick-actions'));

export default async function HomePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <Hero />
        <WhyKambriq />
        <Process />
        <ProductsServices />
        <DiasporaBanner />
        <PartnersSection />
        <Testimonials />
        <FAQ />
      </main>
      <Footer />
      <QuickActions />
    </>
  );
}
