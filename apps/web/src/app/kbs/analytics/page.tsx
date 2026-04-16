import { BookOpen, Award, Target, Clock } from 'lucide-react';

import Navbar from '@/components/layout/navbar';
import { StatCard } from '@/components/dashboard/shared/stat-card';
import { ExamScoresChart } from '@/components/kbs/analytics/exam-scores-chart';
import { StudyTimeChart } from '@/components/kbs/analytics/study-time-chart';
import { SkillRadarChart } from '@/components/kbs/analytics/skill-radar-chart';

export default function KbsAnalyticsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <div className="mx-auto max-w-6xl space-y-8 px-6 py-10 sm:px-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytiques d&apos;apprentissage</h1>
            <p className="text-sm text-gray-500">Suivez votre progression et vos performances.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Progression"
              value="42%"
              icon={<Target className="size-4 text-primary-600" />}
              accent="text-primary-600"
            />
            <StatCard
              label="Modules terminés"
              value="2/6"
              icon={<BookOpen className="size-4 text-success" />}
              accent="text-success"
            />
            <StatCard
              label="Score moyen"
              value="78/100"
              icon={<Award className="size-4 text-gold-600" />}
              accent="text-gold-600"
            />
            <StatCard
              label="Temps total"
              value="44h"
              icon={<Clock className="size-4 text-amber-600" />}
              accent="text-amber-600"
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ExamScoresChart />
            <SkillRadarChart />
          </div>
          <StudyTimeChart />
        </div>
      </main>
    </>
  );
}
