import QuickActions from '@/components/floating/quick-actions';
import Hero from '@/components/products/lands/hero';
import HowItWorks from '@/components/products/lands/how-it-works';
import LandTypes from '@/components/products/lands/land-types';
import WhyBuyAtKambriq from '@/components/products/lands/why-buy-at-kambriq';
import Footer from '@/components/layout/footer';
import Navbar from '@/components/layout/navbar';

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
