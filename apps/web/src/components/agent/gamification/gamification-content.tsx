'use client';

import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { Trophy, Zap, Target, Star } from 'lucide-react';

import { StatCard } from '@/components/dashboard/shared/stat-card';
import { Badge } from '@/components/ui/badge';

const BADGES = [
  { name: 'Première vente', icon: '🏠', earned: true, date: 'Jan 2025' },
  { name: 'Top vendeur mois', icon: '🥇', earned: true, date: 'Fév 2025' },
  { name: '5 ventes', icon: '⭐', earned: true, date: 'Fév 2025' },
  { name: 'Expert diaspora', icon: '🌍', earned: false, date: null },
  { name: '10 ventes', icon: '🔥', earned: false, date: null },
  { name: 'Mentor KAMNET', icon: '👨‍🏫', earned: false, date: null },
];

const XP_DATA = [{ name: 'XP', value: 72, fill: '#4f46e5' }];

const CHALLENGES = [
  { title: 'Réaliser 2 ventes ce mois', progress: 1, total: 2, reward: '+500 XP' },
  { title: 'Parrainer un nouvel agent', progress: 0, total: 1, reward: '+300 XP' },
  {
    title: 'Atteindre 5 étoiles en note client',
    progress: 4.8,
    total: 5,
    reward: '+200 XP',
    isStar: true,
  },
];

export const GamificationContent = () => (
  <div className="mx-auto max-w-5xl space-y-8 px-6 py-10 sm:px-8">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Gamification</h1>
      <p className="text-sm text-gray-500">Vos points, badges et défis en cours.</p>
    </div>

    {/* Stats */}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Niveau"
        value="Senior"
        icon={<Star className="size-4 text-gold-600" />}
        accent="text-gold-600"
      />
      <StatCard
        label="Points XP"
        value="3 240"
        icon={<Zap className="size-4 text-primary-600" />}
        accent="text-primary-600"
      />
      <StatCard
        label="Badges gagnés"
        value="3/6"
        icon={<Trophy className="size-4 text-amber-600" />}
        accent="text-amber-600"
      />
      <StatCard
        label="Classement"
        value="#3"
        icon={<Target className="size-4 text-success" />}
        accent="text-success"
      />
    </div>

    <div className="grid gap-6 lg:grid-cols-3">
      {/* XP gauge */}
      <div className="rounded-2xl border border-border bg-white p-6 text-center shadow-sm">
        <h3 className="mb-4 font-semibold">Progression vers Expert</h3>
        <ResponsiveContainer width="100%" height={160}>
          <RadialBarChart
            innerRadius="60%"
            outerRadius="100%"
            data={XP_DATA}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#f0f0f0' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-2xl font-bold text-primary-600">72%</p>
        <p className="text-xs text-gray-400">3 240 / 4 500 XP</p>
      </div>

      {/* Badges */}
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
        <h3 className="mb-4 font-semibold">Mes badges</h3>
        <div className="grid grid-cols-3 gap-3">
          {BADGES.map((badge) => (
            <div
              key={badge.name}
              className={`flex flex-col items-center rounded-xl p-3 text-center transition-opacity ${badge.earned ? '' : 'opacity-30 grayscale'}`}
            >
              <span className="mb-1.5 text-3xl">{badge.icon}</span>
              <p className="text-xs leading-tight font-medium text-gray-800">{badge.name}</p>
              {badge.date && <p className="mt-0.5 text-xs text-gray-400">{badge.date}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Challenges */}
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <h3 className="mb-5 font-semibold">Défis en cours</h3>
      <div className="space-y-4">
        {CHALLENGES.map((c) => (
          <div key={c.title}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <p className="font-medium text-gray-900">{c.title}</p>
              <Badge variant="outline" className="text-xs text-primary-600">
                {c.reward}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all"
                  style={{ width: `${Math.min((c.progress / c.total) * 100, 100)}%` }}
                />
              </div>
              <span className="shrink-0 text-xs text-gray-400">
                {c.isStar ? `${c.progress}/${c.total}★` : `${c.progress}/${c.total}`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
