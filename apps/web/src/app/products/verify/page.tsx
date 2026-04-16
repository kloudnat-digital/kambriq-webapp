import Navbar from '@/components/layout/navbar';
import HowItWorks from '@/components/products/verify/how-it-works';
import QuickActions from '@/components/floating/quick-actions';
import Footer from '@/components/layout/footer';
import Hero from '@/components/products/verify/hero';
import VerifyFAQ from '@/components/products/verify/faq';
import ReadyToVerify from '@/components/products/verify/ready-to-verify';

export default function VerifyPage() {
  return (
    <>
      <Navbar />
      <main className="bg-white">
        <Hero />
        <HowItWorks />
        <VerifyFAQ />
        <ReadyToVerify />
      </main>
      <Footer />
      <QuickActions />
    </>
  );
}
