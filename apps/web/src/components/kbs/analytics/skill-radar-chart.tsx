'use client';

import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
} from 'recharts';

const DATA = [
  { skill: 'Droit foncier', value: 85 },
  { skill: 'Prospection', value: 70 },
  { skill: 'Négociation', value: 75 },
  { skill: 'Transactions', value: 60 },
  { skill: 'Diaspora', value: 90 },
  { skill: 'Certification', value: 50 },
];

export const SkillRadarChart = () => (
  <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
    <h3 className="mb-1 font-semibold text-gray-900">Compétences acquises</h3>
    <p className="mb-4 text-xs text-gray-400">Score moyen par domaine (sur 100)</p>
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={DATA} outerRadius={90}>
        <PolarGrid stroke="#f0f0f0" />
        <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickCount={4} />
        <Tooltip formatter={(v) => [`${v}/100`]} />
        <Radar
          name="Compétences"
          dataKey="value"
          stroke="#4f46e5"
          fill="#4f46e5"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  </div>
);
