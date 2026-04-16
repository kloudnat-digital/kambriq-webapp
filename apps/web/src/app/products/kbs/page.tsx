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
