import Navbar from '@/components/layout/navbar';
import { ClientDashboardContent } from '@/components/dashboard/client/client-dashboard-content';

export default function ClientDashboardPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <ClientDashboardContent />
      </main>
    </>
  );
}
