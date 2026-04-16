import Navbar from '@/components/layout/navbar';
import { MentorAnalyticsContent } from '@/components/mentorship/mentor-analytics-content';

export default function MentorAnalyticsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <MentorAnalyticsContent />
      </main>
    </>
  );
}
