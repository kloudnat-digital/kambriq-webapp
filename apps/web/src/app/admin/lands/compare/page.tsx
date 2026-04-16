import Navbar from '@/components/layout/navbar';
import { CompareContent } from '@/components/products/lands/compare/compare-content';

export default function CompareLandsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <CompareContent />
      </main>
    </>
  );
}
