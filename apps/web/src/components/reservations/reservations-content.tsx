'use client';

import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { getReservationsAction } from '@/lib/actions/lands';
import { unwrap } from '@/lib/actions/unwrap';
import { useDebounce } from '@/hooks/use-debounce';
import { Spinner } from '@/components/ui/spinner';
import { PaginationBar } from '@/components/ui/pagination';
import { ReservationCard } from './reservation-card';
import { cn } from '@/lib/utils';
import type { LandReservation } from '@/types/lands';
import type { PaginatedResponse } from '@/types/api';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../ui/input-group';
import { LAND_RESERVATION_STATUS_OPTION_KEYS } from '@/constants/land';
import { Badge } from '../ui/badge';

const PAGE_SIZE = 9;

interface ReservationsContentProps {
  isAdmin: boolean;
}

const ReservationsContent: FC<ReservationsContentProps> = ({ isAdmin }) => {
  const t = useTranslations('app.reservations');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const statusOptions = LAND_RESERVATION_STATUS_OPTION_KEYS.map((o) => ({
    value: o.value,
    label: t(o.labelKey),
  }));

  const { data, isLoading, error } = useQuery({
    queryKey: ['reservations', debouncedSearch, status, page],
    queryFn: () =>
      getReservationsAction({
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(status && { status }),
        page,
        limit: PAGE_SIZE,
      }).then(unwrap),
  });

  const payload = data as PaginatedResponse<LandReservation> | null;
  const reservations = payload?.data ?? [];
  const total = payload?.meta?.total ?? 0;
  const totalPages = payload?.meta?.totalPages ?? 1;

  const toggleStatus = (value: string) => setStatus((prev) => (prev === value ? '' : value));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-96 min-w-55 flex-1">
          <InputGroup>
            <InputGroupInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            role="button"
            onClick={() => setStatus('')}
            className={cn(
              'font-medium transition-colors',
              status === ''
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {t('statusAll')}
          </Badge>
          {statusOptions.map((s) => (
            <Badge
              key={s.value}
              role="button"
              onClick={() => toggleStatus(s.value)}
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

      <p className="text-sm text-gray-500">{t('totalCount', { total })}</p>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : error ? (
        <div className="flex h-64 items-center justify-center text-sm text-red-500">
          {(error as Error).message}
        </div>
      ) : reservations.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-gray-400">
          {t('noResults')}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reservations.map((r) => (
            <ReservationCard key={r.id} reservation={r} isAdmin={isAdmin} />
          ))}
        </div>
      )}

      <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
};

export default ReservationsContent;
