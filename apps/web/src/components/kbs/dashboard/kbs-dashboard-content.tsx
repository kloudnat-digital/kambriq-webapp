'use client';

import Link from 'next/link';
import { BookOpen, Award, Target, Clock } from 'lucide-react';

import { StatCard } from '@/components/dashboard/shared/stat-card';
import { Button } from '@/components/ui/button';
import { ModuleProgressCard } from './module-progress-card';

const MODULES = [
  {
    id: 'm1',
    num: 1,
    title: 'Fondamentaux du marché foncier camerounais',
    status: 'completed' as const,
    progress: 100,
    lessonsTotal: 8,
    lessonsCompleted: 8,
  },
  {
    id: 'm2',
    num: 2,
    title: 'Cadre juridique et types de titres',
    status: 'completed' as const,
    progress: 100,
    lessonsTotal: 10,
    lessonsCompleted: 10,
  },
  {
    id: 'm3',
    num: 3,
    title: 'Techniques de prospection diaspora',
    status: 'in_progress' as const,
    progress: 60,
    lessonsTotal: 9,
    lessonsCompleted: 5,
  },
  {
    id: 'm4',
    num: 4,
    title: 'Négociation et closing',
    status: 'locked' as const,
    progress: 0,
    lessonsTotal: 8,
    lessonsCompleted: 0,
  },
  {
    id: 'm5',
    num: 5,
    title: 'Gestion des transactions',
    status: 'locked' as const,
    progress: 0,
    lessonsTotal: 7,
    lessonsCompleted: 0,
  },
  {
    id: 'm6',
    num: 6,
    title: 'Certification KCA et KAMNET',
    status: 'locked' as const,
    progress: 0,
    lessonsTotal: 6,
    lessonsCompleted: 0,
  },
];

export const KbsDashboardContent = () => (
  <div className="mx-auto max-w-5xl space-y-8 px-6 py-10 sm:px-8">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord KBS</h1>
        <p className="text-sm text-gray-500">Étudiant · Promotion 2025</p>
      </div>
      <Button asChild>
        <Link href="/kbs/exam">Passer l&apos;examen</Link>
      </Button>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Progression globale"
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
        label="Temps d'étude"
        value="24h"
        icon={<Clock className="size-4 text-amber-600" />}
        accent="text-amber-600"
      />
    </div>

    <div>
      <h2 className="mb-5 text-lg font-semibold">Mes modules</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {MODULES.map((m) => (
          <ModuleProgressCard key={m.id} module={m} />
        ))}
      </div>
    </div>
  </div>
);
