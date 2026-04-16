'use client';

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

const DATA = [
  { stage: 'Contacts', count: 24, color: '#e2e8f0' },
  { stage: 'Prospecté', count: 18, color: '#c7d2fe' },
  { stage: 'Visité', count: 11, color: '#a5b4fc' },
  { stage: 'Réservé', count: 5, color: '#818cf8' },
  { stage: 'Vendu', count: 3, color: '#4f46e5' },
];

export const AgentPipeline = () => (
  <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
    <h3 className="mb-1 font-semibold text-gray-900">Pipeline de vente</h3>
    <p className="mb-5 text-xs text-gray-400">Nombre de prospects par étape</p>
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={DATA} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="stage" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {DATA.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);
