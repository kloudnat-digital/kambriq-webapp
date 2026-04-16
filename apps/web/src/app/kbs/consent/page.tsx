import Navbar from '@/components/layout/navbar';
import { ConsentContent } from '@/components/kbs/consent/consent-content';

export default function KBSConsentPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <ConsentContent />
      </main>
    </>
  );
}
