import Link from 'next/link';
import { BookOpen, Users, BarChart2, FileText } from 'lucide-react';

import Navbar from '@/components/layout/navbar';
import { StatCard } from '@/components/dashboard/shared/stat-card';

const MODULES = [
  { id: 'm1', num: 1, title: 'Fondamentaux du marché foncier', lessonsCount: 6, studentsCount: 42 },
  {
    id: 'm2',
    num: 2,
    title: 'Cadre juridique et types de titres',
    lessonsCount: 8,
    studentsCount: 38,
  },
  {
    id: 'm3',
    num: 3,
    title: 'Techniques de prospection diaspora',
    lessonsCount: 7,
    studentsCount: 31,
  },
  { id: 'm4', num: 4, title: 'Négociation et closing', lessonsCount: 6, studentsCount: 22 },
  { id: 'm5', num: 5, title: 'Gestion des transactions', lessonsCount: 5, studentsCount: 15 },
  { id: 'm6', num: 6, title: 'Certification KCA et KAMNET', lessonsCount: 4, studentsCount: 8 },
];

export default function KbsAdminPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <div className="mx-auto max-w-6xl space-y-8 px-6 py-10 sm:px-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Administration KBS</h1>
            <p className="text-sm text-gray-500">Gérez les modules, leçons et candidatures.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Étudiants actifs"
              value={42}
              icon={<Users className="size-4 text-primary-600" />}
              accent="text-primary-600"
            />
            <StatCard
              label="Certifiés KCA"
              value={18}
              icon={<BookOpen className="size-4 text-success" />}
              accent="text-success"
            />
            <StatCard
              label="Candidatures"
              value={7}
              icon={<FileText className="size-4 text-amber-600" />}
              accent="text-amber-600"
              sub="En attente"
            />
            <StatCard
              label="Score moyen"
              value="74/100"
              icon={<BarChart2 className="size-4 text-blue-600" />}
              accent="text-blue-600"
            />
          </div>
          <div className="rounded-2xl border border-border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-semibold">Modules</h2>
              <Link
                href="/kbs/admin/candidates"
                className="text-sm text-primary-600 hover:underline"
              >
                Voir les candidatures →
              </Link>
            </div>
            <div className="divide-y divide-border">
              {MODULES.map((m) => (
                <div key={m.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10 text-sm font-bold text-primary-600">
                    {m.num}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.title}</p>
                    <p className="text-xs text-gray-400">
                      {m.lessonsCount} leçons · {m.studentsCount} étudiants
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/kbs/admin/module/${m.id}`}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      Modifier
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
