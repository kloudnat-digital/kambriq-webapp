'use client';

import { useTranslations } from 'next-intl';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const DATA = [
  { month: 'Jan', ventes: 1, commissions: 750000 },
  { month: 'Fév', ventes: 0, commissions: 0 },
  { month: 'Mar', ventes: 2, commissions: 1500000 },
  { month: 'Avr', ventes: 1, commissions: 960000 },
  { month: 'Mai', ventes: 3, commissions: 2400000 },
  { month: 'Jun', ventes: 2, commissions: 1800000 },
];

const formatXAFShort = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1000
      ? `${(v / 1000).toFixed(0)}k`
      : String(v);

export const AgentSalesChart = () => {
  const t = useTranslations('app.agentDashboard.salesChart');
  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <h3 className="mb-1 font-semibold text-gray-900">{t('title')}</h3>
      <p className="mb-5 text-xs text-gray-400">{t('subtitle')}</p>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={DATA} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={formatXAFShort}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip formatter={(v) => [`${formatXAFShort(Number(v))} XAF`, t('tooltipLabel')]} />
          <Area
            type="monotone"
            dataKey="commissions"
            stroke="#4f46e5"
            strokeWidth={2}
            fill="url(#commGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
