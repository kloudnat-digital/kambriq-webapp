export const dynamic = 'force-dynamic';

import { CheckCircle, XCircle } from 'lucide-react';

import Navbar from '@/components/layout/navbar';
import { Badge } from '@/components/ui/badge';

const HISTORY = [
  { id: 1, module: 'Module 1', date: '15 jan 2025', score: 88, passed: true },
  { id: 2, module: 'Module 2', date: '22 jan 2025', score: 74, passed: true },
  { id: 3, module: 'Module 3', date: '01 fév 2025', score: 55, passed: false },
  { id: 4, module: 'Module 3', date: '08 fév 2025', score: 78, passed: true },
];

export default function ExamHistoryPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-10 sm:px-8">
          <h1 className="text-2xl font-bold text-gray-900">Historique des examens</h1>
          <div className="rounded-2xl border border-border bg-white shadow-sm">
            <div className="divide-y divide-border">
              {HISTORY.map((h) => (
                <div key={h.id} className="flex items-center gap-4 px-6 py-4">
                  {h.passed ? (
                    <CheckCircle className="size-5 shrink-0 text-success" />
                  ) : (
                    <XCircle className="size-5 shrink-0 text-red-400" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{h.module}</p>
                    <p className="text-xs text-gray-400">{h.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      {h.score}
                      <span className="text-sm font-normal text-gray-400">/100</span>
                    </p>
                    <Badge
                      className={
                        h.passed
                          ? 'border-success/30 bg-success/10 text-success'
                          : 'border-red-300 bg-red-50 text-red-700'
                      }
                    >
                      {h.passed ? 'Réussi' : 'Échoué'}
                    </Badge>
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
