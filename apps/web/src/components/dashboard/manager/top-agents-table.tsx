'use client';

import { useTranslations } from 'next-intl';
import { Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const AGENTS = [
  { rank: 1, name: 'Marie Kameni', sales: 12, revenue: '96M XAF', level: 'Expert' },
  { rank: 2, name: 'Paul Eteme', sales: 9, revenue: '72M XAF', level: 'Senior' },
  { rank: 3, name: 'Sophie Mbarga', sales: 7, revenue: '56M XAF', level: 'Senior' },
  { rank: 4, name: 'Alain Fotso', sales: 5, revenue: '35M XAF', level: 'Junior' },
  { rank: 5, name: 'Claire Ngo', sales: 4, revenue: '28M XAF', level: 'Junior' },
];

const RANK_COLORS = ['text-gold-500', 'text-gray-400', 'text-amber-600'];

export const TopAgentsTable = () => {
  const t = useTranslations('app.managerDashboard.topAgents');
  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-6 py-4">
        <Trophy className="size-4 text-gold-500" />
        <h3 className="font-semibold text-gray-900">{t('title')}</h3>
      </div>
      <div className="divide-y divide-border">
        {AGENTS.map((a) => (
          <div key={a.rank} className="flex items-center gap-4 px-6 py-3">
            <span
              className={`w-6 text-center text-sm font-bold ${RANK_COLORS[a.rank - 1] ?? 'text-gray-400'}`}
            >
              #{a.rank}
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-xs font-bold text-primary-600">
              {a.name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{a.name}</p>
              <p className="text-xs text-gray-500">
                {a.sales} {t('salesUnit')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{a.revenue}</p>
              <Badge variant="outline" className="text-xs">
                {a.level}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
