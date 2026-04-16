import Navbar from '@/components/layout/navbar';
import { GamificationContent } from '@/components/agent/gamification/gamification-content';

export default function GamificationPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <GamificationContent />
      </main>
    </>
  );
}
