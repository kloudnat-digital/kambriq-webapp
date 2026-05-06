'use client';

import type { FC } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getLandsAction } from '@/lib/actions/lands';
import { unwrap } from '@/lib/actions/unwrap';
import { useDebounce } from '@/hooks/use-debounce';
import { AGENT_LAND_STATUS_OPTION_KEYS, LAND_STATUS_OPTION_KEYS } from '@/constants/land';
import LandCard from './land-card';
import LandsFilters from './lands-filters';
import { Spinner } from '@/components/ui/spinner';
import { PaginationBar } from '@/components/ui/pagination';
import type { Land } from '@/types/lands';
import type { PaginatedResponse } from '@/types/api';

const PAGE_SIZE = 6;

interface Props {
  isAdmin: boolean;
}

const LandsCatalogContent: FC<Props> = ({ isAdmin }) => {
  const t = useTranslations('app.landsPage');
  const optionKeys = isAdmin ? LAND_STATUS_OPTION_KEYS : AGENT_LAND_STATUS_OPTION_KEYS;
  const statusOptions = optionKeys.map((o) => ({ value: o.value, label: t(o.labelKey) }));

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: '', labelCode: '', status: '' });
  const debouncedSearch = useDebounce(filters.search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['lands', debouncedSearch, filters.labelCode, filters.status, page],
    queryFn: () =>
      getLandsAction({
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filters.labelCode && { labelCode: filters.labelCode }),
        ...(filters.status && { status: filters.status }),
        page,
        limit: PAGE_SIZE,
      }).then(unwrap),
  });

  const payload = data as PaginatedResponse<Land> | null;
  const lands = payload?.data ?? [];
  const total = payload?.meta?.total ?? 0;
  const totalPages = payload?.meta?.totalPages ?? 1;

  const handleFilter = (key: string, value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="h-full space-y-5">
      <LandsFilters
        search={filters.search}
        labelCode={filters.labelCode}
        status={filters.status}
        statuses={statusOptions}
        onChange={handleFilter}
      />

      <p className="text-sm text-gray-500">{t('totalCount', { total })}</p>

      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : lands.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-gray-400">
          {t('noResults')}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lands.map((land) => (
            <LandCard key={land.id} land={land} />
          ))}
        </div>
      )}

      <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
};

export default LandsCatalogContent;
