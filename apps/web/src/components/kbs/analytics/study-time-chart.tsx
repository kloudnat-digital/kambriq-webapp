'use client';

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
  { week: 'S1', hours: 3 },
  { week: 'S2', hours: 5 },
  { week: 'S3', hours: 2 },
  { week: 'S4', hours: 7 },
  { week: 'S5', hours: 4 },
  { week: 'S6', hours: 8 },
  { week: 'S7', hours: 6 },
  { week: 'S8', hours: 9 },
];

export const StudyTimeChart = () => (
  <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
    <h3 className="mb-1 font-semibold text-gray-900">Temps d&apos;étude hebdomadaire</h3>
    <p className="mb-4 text-xs text-gray-400">Heures par semaine</p>
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={DATA} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="studyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="week" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => [`${v}h`, "Temps d'étude"]} />
        <Area
          type="monotone"
          dataKey="hours"
          stroke="#22c55e"
          strokeWidth={2}
          fill="url(#studyGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);
