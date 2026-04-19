'use client';

import { useTranslations } from 'next-intl';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

const COLORS = ['#e2e8f0', '#c7d2fe', '#a5b4fc', '#818cf8', '#4f46e5'];

export const AgentPipeline = () => {
  const t = useTranslations('app.agentDashboard.pipeline');
  const DATA = [
    { stage: t('stage1'), count: 24 },
    { stage: t('stage2'), count: 18 },
    { stage: t('stage3'), count: 11 },
    { stage: t('stage4'), count: 5 },
    { stage: t('stage5'), count: 3 },
  ];
  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <h3 className="mb-1 font-semibold text-gray-900">{t('title')}</h3>
      <p className="mb-5 text-xs text-gray-400">{t('subtitle')}</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={DATA} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="stage" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {DATA.map((_, i) => (
              <Cell key={i} fill={COLORS[i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
