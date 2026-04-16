import Navbar from '@/components/layout/navbar';
import { AgentDashboardContent } from '@/components/dashboard/agent/agent-dashboard-content';

export default function AgentDashboardPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <AgentDashboardContent />
      </main>
    </>
  );
}
