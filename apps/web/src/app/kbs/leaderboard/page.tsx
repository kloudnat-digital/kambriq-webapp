import Navbar from '@/components/layout/navbar';
import { LeaderboardTable } from '@/components/kbs/leaderboard/leaderboard-table';

export default function KbsLeaderboardPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-10 sm:px-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Classement KBS</h1>
            <p className="text-sm text-gray-500">
              Les meilleurs étudiants de la KAMBRIQ Business School.
            </p>
          </div>
          <LeaderboardTable />
        </div>
      </main>
    </>
  );
}
