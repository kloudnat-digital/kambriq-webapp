import Navbar from '@/components/layout/navbar';
import { MentorshipContent } from '@/components/mentorship/mentorship-content';

export default function MentorshipPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <MentorshipContent />
      </main>
    </>
  );
}
