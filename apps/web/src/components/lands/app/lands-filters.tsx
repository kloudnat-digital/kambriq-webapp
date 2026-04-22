'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const LABELS = ['TFL', 'VEFL', 'VEFIL'];
const STATUSES = [
  { value: '', label: 'Tous' },
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'RESERVED', label: 'Réservé' },
];

interface LandsFiltersProps {
  search: string;
  labelCode: string;
  status: string;
  onChange: (key: string, value: string) => void;
}

export const LandsFilters = ({ search, labelCode, status, onChange }: LandsFiltersProps) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => onChange('search', e.target.value)}
          placeholder="Rechercher par zone, label…"
          className="pl-9"
        />
      </div>

      {/* Label pills */}
      <div className="flex items-center gap-1.5">
        {['', ...LABELS].map((l) => (
          <button
            key={l}
            onClick={() => onChange('labelCode', l)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              labelCode === l
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {l || 'Tous'}
          </button>
        ))}
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange('status', s.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              status === s.value
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
};
