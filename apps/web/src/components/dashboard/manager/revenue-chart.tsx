'use client';

import { useTranslations } from 'next-intl';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const DATA = [
  { month: 'Sep', revenus: 45_000_000, ventes: 3 },
  { month: 'Oct', revenus: 62_000_000, ventes: 4 },
  { month: 'Nov', revenus: 38_000_000, ventes: 2 },
  { month: 'Déc', revenus: 81_000_000, ventes: 5 },
  { month: 'Jan', revenus: 54_000_000, ventes: 3 },
  { month: 'Fév', revenus: 97_000_000, ventes: 6 },
];

const fmtM = (v: number) => `${(v / 1_000_000).toFixed(0)}M`;

export const RevenueChart = () => {
  const t = useTranslations('app.managerDashboard.revenueChart');
  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <h3 className="mb-1 font-semibold text-gray-900">{t('title')}</h3>
      <p className="mb-4 text-xs text-gray-400">{t('subtitle')}</p>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={DATA} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="rev"
            tickFormatter={fmtM}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <YAxis
            yAxisId="sales"
            orientation="right"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={24}
          />
          <Tooltip
            formatter={(v, name) => [name === 'revenus' ? `${fmtM(Number(v))} XAF` : v, name]}
          />
          <Legend />
          <Bar
            yAxisId="rev"
            dataKey="revenus"
            name={t('revenueLabel')}
            fill="#c7d2fe"
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="sales"
            type="monotone"
            dataKey="ventes"
            name={t('salesLabel')}
            stroke="#4f46e5"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
