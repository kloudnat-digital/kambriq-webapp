'use client';

import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { useTranslations } from 'next-intl';
import { LAND_LABEL_CODES, type StatusOption } from '@/constants/land';
import type { FC } from 'react';
import { Badge } from '@/components/ui/badge';

interface LandsFiltersProps {
  search: string;
  labelCode: string;
  status: string;
  statuses: StatusOption[];
  onChange: (key: string, value: string) => void;
}

const LandsFilters: FC<LandsFiltersProps> = ({ search, labelCode, status, statuses, onChange }) => {
  const t = useTranslations('app.landsPage');
  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <div className="relative max-w-96 min-w-55 flex-1">
        <InputGroup>
          <InputGroupInput
            value={search}
            onChange={(e) => onChange('search', e.target.value)}
            placeholder={t('searchPlaceholder')}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
      </div>

      <div className="flex items-center gap-1.5">
        {(['', ...LAND_LABEL_CODES] as string[]).map((l) => (
          <Badge
            key={l}
            role="button"
            onClick={() => onChange('labelCode', l)}
            className={cn(
              'font-medium transition-colors',
              labelCode === l
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {l || t('allLabels')}
          </Badge>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        {statuses.map((s) => (
          <Badge
            key={s.value}
            role="button"
            onClick={() => onChange('status', s.value)}
            className={cn(
              'font-medium transition-colors',
              status === s.value
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {s.label}
          </Badge>
        ))}
      </div>
    </div>
  );
};

export default LandsFilters;
