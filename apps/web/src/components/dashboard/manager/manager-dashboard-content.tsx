'use client';

import { MapPin, TrendingUp, Users, DollarSign } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { StatCard } from '@/components/dashboard/shared/stat-card';
import { LandsStatusChart } from './lands-status-chart';
import { RevenueChart } from './revenue-chart';
import { TopAgentsTable } from './top-agents-table';

export const ManagerDashboardContent = () => {
  const t = useTranslations('app.managerDashboard');
  const STATS = [
    {
      label: t('statLands'),
      value: 37,
      icon: <MapPin className="size-4 text-primary-600" />,
      accent: 'text-primary-600',
      sub: '3 archivés',
    },
    {
      label: t('statSales'),
      value: 6,
      icon: <TrendingUp className="size-4 text-success" />,
      accent: 'text-success',
      sub: '+2 vs mois dernier',
    },
    {
      label: t('statAgents'),
      value: 12,
      icon: <Users className="size-4 text-amber-600" />,
      accent: 'text-amber-600',
      sub: '3 certifiés Expert',
    },
    {
      label: t('statRevenue'),
      value: '97M XAF',
      icon: <DollarSign className="size-4 text-blue-600" />,
      accent: 'text-blue-600',
      sub: '+28% vs mois dernier',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-10 sm:px-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            sub={s.sub}
            accent={s.accent}
            icon={s.icon}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LandsStatusChart />
        <RevenueChart />
      </div>

      <TopAgentsTable />
    </div>
  );
};
