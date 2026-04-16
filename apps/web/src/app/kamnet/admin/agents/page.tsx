import Navbar from '@/components/layout/navbar';
import { AgentsManagementContent } from '@/components/kamnet/agents-management-content';

export default function KamnetAgentsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <AgentsManagementContent />
      </main>
    </>
  );
}
