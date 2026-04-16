'use client';

import { TrendingUp, Users, MapPin, Award } from 'lucide-react';

import { StatCard } from '@/components/dashboard/shared/stat-card';
import { AgentSalesChart } from './agent-sales-chart';
import { AgentPipeline } from './agent-pipeline';
import { AgentRecentClients } from './agent-recent-clients';

const STATS = [
  {
    label: 'Ventes ce mois',
    value: 2,
    icon: <MapPin className="size-4 text-primary-600" />,
    accent: 'text-primary-600',
  },
  {
    label: 'Commissions (mois)',
    value: '1.8M XAF',
    icon: <TrendingUp className="size-4 text-success" />,
    accent: 'text-success',
  },
  {
    label: 'Clients actifs',
    value: 8,
    icon: <Users className="size-4 text-amber-600" />,
    accent: 'text-amber-600',
  },
  {
    label: 'Niveau',
    value: 'Senior KCA',
    icon: <Award className="size-4 text-gold-600" />,
    accent: 'text-gold-600',
  },
];

export const AgentDashboardContent = () => (
  <div className="mx-auto max-w-7xl space-y-8 px-6 py-10 sm:px-8">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Tableau de bord Agent</h1>
      <p className="text-sm text-gray-500">Bienvenue, Marie Kameni · KCA-2024-0145</p>
    </div>

    {/* Stats grid */}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STATS.map((s) => (
        <StatCard key={s.label} label={s.label} value={s.value} accent={s.accent} icon={s.icon} />
      ))}
    </div>

    {/* Charts row */}
    <div className="grid gap-6 lg:grid-cols-2">
      <AgentSalesChart />
      <AgentPipeline />
    </div>

    {/* Recent clients */}
    <AgentRecentClients />
  </div>
);
