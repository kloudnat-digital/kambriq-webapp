import Navbar from '@/components/layout/navbar';
import { ManagerDashboardContent } from '@/components/dashboard/manager/manager-dashboard-content';

export default function ManagerDashboardPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <ManagerDashboardContent />
      </main>
    </>
  );
}
