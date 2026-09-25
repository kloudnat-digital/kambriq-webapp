'use client';

import { useState } from 'react';
import { Search, CheckCircle, XCircle, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Agent = {
  id: string;
  name: string;
  email: string;
  phone: string;
  level: 'Junior' | 'Senior' | 'Expert';
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  sales: number;
  joinDate: string;
  kcaNumber: string;
};

const MOCK_AGENTS: Agent[] = [
  {
    id: '1',
    name: 'Marie Kameni',
    email: 'marie@kambriq.com',
    phone: '+237699001',
    level: 'Expert',
    status: 'ACTIVE',
    sales: 24,
    joinDate: '2023-06-15',
    kcaNumber: 'KCA-2023-0012',
  },
  {
    id: '2',
    name: 'Paul Eteme',
    email: 'paul@example.com',
    phone: '+237699002',
    level: 'Senior',
    status: 'ACTIVE',
    sales: 15,
    joinDate: '2024-01-10',
    kcaNumber: 'KCA-2024-0045',
  },
  {
    id: '3',
    name: 'Sophie Mbarga',
    email: 'sophie@example.com',
    phone: '+237699003',
    level: 'Junior',
    status: 'PENDING',
    sales: 2,
    joinDate: '2025-01-05',
    kcaNumber: 'KCA-2025-0089',
  },
  {
    id: '4',
    name: 'Alain Fotso',
    email: 'alain@example.com',
    phone: '+237699004',
    level: 'Senior',
    status: 'SUSPENDED',
    sales: 8,
    joinDate: '2024-06-20',
    kcaNumber: 'KCA-2024-0102',
  },
];

const LEVEL_STYLES = {
  Junior: 'border-gray-200 text-gray-600',
  Senior: 'border-primary-200 text-primary-700',
  Expert: 'border-gold-300 text-gold-700 bg-gold-50',
};
const STATUS_STYLES = {
  ACTIVE: 'border-success/30 bg-success/10 text-success',
  PENDING: 'border-amber-300 bg-amber-50 text-amber-700',
  SUSPENDED: 'border-red-300 bg-red-50 text-red-700',
};
const STATUS_LABELS = { ACTIVE: 'Actif', PENDING: 'En attente', SUSPENDED: 'Suspendu' };

export const AgentsManagementContent = () => {
  const [search, setSearch] = useState('');

  const filtered = MOCK_AGENTS.filter(
    (a) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.kcaNumber.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des agents KAMNET™</h1>
          <p className="text-sm text-gray-500">{MOCK_AGENTS.length} agents au total</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-8 text-sm"
            placeholder="Rechercher un agent…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-gray-50/60">
              <tr>
                {['Agent', 'Numéro KCA', 'Niveau', 'Ventes', 'Statut', 'Depuis', 'Actions'].map(
                  (h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-xs font-bold text-primary-600">
                        {agent.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-xs text-gray-400">{agent.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{agent.kcaNumber}</td>
                  <td className="px-5 py-3">
                    <Badge variant="outline" className={LEVEL_STYLES[agent.level]}>
                      {agent.level}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 font-semibold">{agent.sales}</td>
                  <td className="px-5 py-3">
                    <Badge className={STATUS_STYLES[agent.status]}>
                      {STATUS_LABELS[agent.status]}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{agent.joinDate}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      {agent.status === 'ACTIVE' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-red-500"
                          onClick={() => toast.success('Agent suspendu')}
                        >
                          <XCircle className="size-3.5" />
                        </Button>
                      )}
                      {agent.status === 'SUSPENDED' && (
                        <Button
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => toast.success('Agent réactivé')}
                        >
                          <CheckCircle className="size-3.5" />
                        </Button>
                      )}
                      {agent.status === 'PENDING' && (
                        <Button
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => toast.success('Agent approuvé')}
                        >
                          <CheckCircle className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => toast.info('Options')}
                      >
                        <MoreVertical className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
