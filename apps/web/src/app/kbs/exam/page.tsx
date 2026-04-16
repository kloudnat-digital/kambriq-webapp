import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import Navbar from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { ExamContent } from '@/components/kbs/exam/exam-content';

export default function KbsExamPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <div className="mx-auto max-w-2xl px-6 py-10 sm:px-8">
          <div className="mb-8 flex items-center gap-4">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href="/kbs/dashboard">
                <ArrowLeft className="size-4" /> Dashboard
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Examen KBS — Module 3</h1>
              <p className="text-xs text-gray-500">5 questions · Durée : 15 minutes</p>
            </div>
          </div>
          <ExamContent />
        </div>
      </main>
    </>
  );
}
