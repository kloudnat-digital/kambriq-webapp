'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';

const DATA = [
  { module: 'Mod. 1', score: 88 },
  { module: 'Mod. 2', score: 74 },
  { module: 'Mod. 3', score: 91 },
  { module: 'Mod. 4', score: 65 },
  { module: 'Mod. 5', score: 82 },
  { module: 'Mod. 6', score: 78 },
];

const PASS_MARK = 60;

export const ExamScoresChart = () => (
  <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
    <h3 className="mb-1 font-semibold text-gray-900">Scores par module</h3>
    <p className="mb-4 text-xs text-gray-400">Seuil de réussite : {PASS_MARK}/100</p>
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={DATA} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="module" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => [`${v}/100`, 'Score']} />
        <ReferenceLine
          y={PASS_MARK}
          stroke="#f59e0b"
          strokeDasharray="4 4"
          label={{ value: `Seuil ${PASS_MARK}`, fontSize: 11, fill: '#f59e0b' }}
        />
        <Bar dataKey="score" radius={[6, 6, 0, 0]}>
          {DATA.map((entry, i) => (
            <Cell key={i} fill={entry.score >= PASS_MARK ? '#4f46e5' : '#fca5a5'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);
