'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';

import { StatCard } from '@/components/dashboard/shared/stat-card';
import { Users, Star, Clock, TrendingUp } from 'lucide-react';

const SESSIONS_DATA = [
  { month: 'Oct', sessions: 4 },
  { month: 'Nov', sessions: 6 },
  { month: 'Déc', sessions: 3 },
  { month: 'Jan', sessions: 8 },
  { month: 'Fév', sessions: 7 },
  { month: 'Mar', sessions: 10 },
];

const RATINGS_DATA = [
  { week: 'S1', rating: 4.5 },
  { week: 'S2', rating: 4.7 },
  { week: 'S3', rating: 4.6 },
  { week: 'S4', rating: 4.9 },
  { week: 'S5', rating: 4.8 },
  { week: 'S6', rating: 5.0 },
];

export const MentorAnalyticsContent = () => (
  <div className="mx-auto max-w-5xl space-y-8 px-6 py-10 sm:px-8">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Analytiques Mentor</h1>
      <p className="text-sm text-gray-500">Vos performances en tant que mentor KAMNET.</p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Mentorés actifs"
        value={6}
        icon={<Users className="size-4 text-primary-600" />}
        accent="text-primary-600"
      />
      <StatCard
        label="Sessions ce mois"
        value={10}
        icon={<Clock className="size-4 text-amber-600" />}
        accent="text-amber-600"
      />
      <StatCard
        label="Note moyenne"
        value="4.8/5"
        icon={<Star className="size-4 text-gold-600" />}
        accent="text-gold-600"
      />
      <StatCard
        label="Taux de conversion"
        value="67%"
        icon={<TrendingUp className="size-4 text-success" />}
        accent="text-success"
      />
    </div>

    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h3 className="mb-1 font-semibold text-gray-900">Sessions de mentorship</h3>
        <p className="mb-4 text-xs text-gray-400">6 derniers mois</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={SESSIONS_DATA} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey="sessions" fill="#4f46e5" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h3 className="mb-1 font-semibold text-gray-900">Évolution des notes</h3>
        <p className="mb-4 text-xs text-gray-400">Note hebdomadaire des mentorés</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={RATINGS_DATA} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis domain={[4, 5]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => [`${v}/5`, 'Note']} />
            <Line
              type="monotone"
              dataKey="rating"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#f59e0b' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);
