'use client';

import { useState } from 'react';
import { Search, Check, X, Eye } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type VerifyRequest = {
  id: string;
  tfNumber: string;
  location: string;
  clientName: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  submittedAt: string;
};

const MOCK: VerifyRequest[] = [
  {
    id: '1',
    tfNumber: 'TF 421/MF',
    location: 'Yaoundé, Bastos',
    clientName: 'Jean Dupont',
    status: 'PENDING',
    submittedAt: '2025-01-15',
  },
  {
    id: '2',
    tfNumber: 'TF 34/OC',
    location: 'Kribi, Bord de Mer',
    clientName: 'Alphonse Biya',
    status: 'IN_PROGRESS',
    submittedAt: '2025-01-18',
  },
  {
    id: '3',
    tfNumber: 'TF 89/MF',
    location: 'Yaoundé, Ekounou',
    clientName: 'Sandra Njoh',
    status: 'COMPLETED',
    submittedAt: '2025-01-10',
  },
  {
    id: '4',
    tfNumber: 'TF 1123/WB',
    location: 'Douala, Bonanjo',
    clientName: 'Roland Fouda',
    status: 'REJECTED',
    submittedAt: '2025-01-08',
  },
];

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'border-amber-300 bg-amber-50 text-amber-700',
  IN_PROGRESS: 'border-blue-300 bg-blue-50 text-blue-700',
  COMPLETED: 'border-success/30 bg-success/10 text-success',
  REJECTED: 'border-red-300 bg-red-50 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminé',
  REJECTED: 'Rejeté',
};

export const VerifyRequestsTable = () => {
  const [search, setSearch] = useState('');

  const filtered = MOCK.filter(
    (r) =>
      !search ||
      r.tfNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.clientName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex items-center gap-4 border-b border-border px-6 py-4">
        <h3 className="font-semibold text-gray-900">Demandes de vérification</h3>
        <div className="relative ml-auto w-64">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-gray-50/60">
            <tr>
              {['Titre foncier', 'Localisation', 'Client', 'Statut', 'Date', 'Actions'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50/50">
                <td className="px-5 py-3 font-mono text-xs font-medium">{r.tfNumber}</td>
                <td className="px-5 py-3 text-gray-600">{r.location}</td>
                <td className="px-5 py-3 font-medium">{r.clientName}</td>
                <td className="px-5 py-3">
                  <Badge className={STATUS_STYLES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                </td>
                <td className="px-5 py-3 text-gray-500">{r.submittedAt}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => toast.info('Vue détaillée')}
                    >
                      <Eye className="size-3.5" />
                    </Button>
                    {r.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => toast.success('Démarrée')}
                        >
                          <Check className="size-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-red-500 hover:text-red-600"
                          onClick={() => toast.success('Rejetée')}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
