'use client';

import { TrendingUp, Users, MapPin, Award } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { StatCard } from '@/components/dashboard/shared/stat-card';
import { AgentSalesChart } from './agent-sales-chart';
import { AgentPipeline } from './agent-pipeline';
import { AgentRecentClients } from './agent-recent-clients';

export const AgentDashboardContent = () => {
  const t = useTranslations('app.agentDashboard');
  const STATS = [
    {
      label: t('statSales'),
      value: 2,
      icon: <MapPin className="size-4 text-primary-600" />,
      accent: 'text-primary-600',
    },
    {
      label: t('statCommissions'),
      value: '1.8M XAF',
      icon: <TrendingUp className="size-4 text-success" />,
      accent: 'text-success',
    },
    {
      label: t('statClients'),
      value: 8,
      icon: <Users className="size-4 text-amber-600" />,
      accent: 'text-amber-600',
    },
    {
      label: t('statLevel'),
      value: 'KCA',
      icon: <Award className="size-4 text-gold-600" />,
      accent: 'text-gold-600',
    },
  ];
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-10 sm:px-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500">KCA-2024-0145</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} accent={s.accent} icon={s.icon} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <AgentSalesChart />
        <AgentPipeline />
      </div>
      <AgentRecentClients />
    </div>
  );
};
