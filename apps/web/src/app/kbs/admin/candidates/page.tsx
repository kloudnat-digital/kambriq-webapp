'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Check, X, Eye } from 'lucide-react';
import { toast } from 'sonner';

import Navbar from '@/components/layout/navbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const CANDIDATES = [
  {
    id: '1',
    name: 'Jean Dupont',
    email: 'jean@example.com',
    country: 'France',
    status: 'PENDING' as const,
    date: '2025-02-01',
  },
  {
    id: '2',
    name: 'Alice Kameni',
    email: 'alice@example.com',
    country: 'Canada',
    status: 'PENDING' as const,
    date: '2025-02-03',
  },
  {
    id: '3',
    name: 'Roland Fouda',
    email: 'roland@example.com',
    country: 'Belgique',
    status: 'APPROVED' as const,
    date: '2025-01-25',
  },
  {
    id: '4',
    name: 'Marie Ngo',
    email: 'marie@example.com',
    country: 'Cameroun',
    status: 'REJECTED' as const,
    date: '2025-01-20',
  },
];

const STATUS_STYLES = {
  PENDING: 'border-amber-300 bg-amber-50 text-amber-700',
  APPROVED: 'border-success/30 bg-success/10 text-success',
  REJECTED: 'border-red-300 bg-red-50 text-red-700',
};
const STATUS_LABELS = { PENDING: 'En attente', APPROVED: 'Approuvé', REJECTED: 'Rejeté' };

export default function KbsCandidatesPage() {
  const [candidates, setCandidates] = useState(CANDIDATES);

  const updateStatus = (id: string, status: 'APPROVED' | 'REJECTED') => {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    toast.success(status === 'APPROVED' ? 'Candidature approuvée' : 'Candidature rejetée');
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <div className="mx-auto max-w-5xl space-y-6 px-6 py-10 sm:px-8">
          <h1 className="text-2xl font-bold">Candidatures KBS</h1>
          <div className="rounded-2xl border border-border bg-white shadow-sm">
            <div className="divide-y divide-border">
              {candidates.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-sm font-bold text-primary-600">
                    {c.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">
                      {c.email} · {c.country} · {c.date}
                    </p>
                  </div>
                  <Badge className={STATUS_STYLES[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => toast.info('Vue candidature')}
                    >
                      <Eye className="size-3.5" />
                    </Button>
                    {c.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs"
                          onClick={() => updateStatus(c.id, 'APPROVED')}
                        >
                          <Check className="size-3.5" /> Approuver
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs text-red-500"
                          onClick={() => updateStatus(c.id, 'REJECTED')}
                        >
                          <X className="size-3.5" /> Rejeter
                        </Button>
                      </>
                    )}
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
