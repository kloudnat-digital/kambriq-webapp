'use client';

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const DATA = [
  { name: 'Disponibles', value: 18, color: '#22c55e' },
  { name: 'Réservés', value: 7, color: '#f59e0b' },
  { name: 'Vendus', value: 12, color: '#3b82f6' },
  { name: 'Archivés', value: 3, color: '#9ca3af' },
];

export const LandsStatusChart = () => (
  <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
    <h3 className="mb-1 font-semibold text-gray-900">Statut du portefeuille</h3>
    <p className="mb-4 text-xs text-gray-400">40 terrains au total</p>
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={DATA}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={3}
          dataKey="value"
        >
          {DATA.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(v, name) => [`${v} terrains`, name]} />
        <Legend iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  </div>
);
