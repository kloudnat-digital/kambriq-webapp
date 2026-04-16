import Navbar from '@/components/layout/navbar';
import { KbsDashboardContent } from '@/components/kbs/dashboard/kbs-dashboard-content';

export default function KbsStudentDashboardPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <KbsDashboardContent />
      </main>
    </>
  );
}
