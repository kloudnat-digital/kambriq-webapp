'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getLands } from '@/lib/actions/lands';
import { unwrap } from '@/lib/actions/unwrap';
import { LandCard } from './land-card';
import { LandsFilters } from './lands-filters';
import { Spinner } from '@/components/ui/spinner';

const isAdmin = (roles: string[]) =>
  roles.includes('ADMIN_LANDS') || roles.includes('ADMIN_GLOBAL');

export const LandsCatalogContent = () => {
  const { data: session } = useSession();
  const userRoles = (session?.user as { roles?: string[] })?.roles ?? [];
  const admin = isAdmin(userRoles);

  const [filters, setFilters] = useState({ search: '', labelCode: '', status: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['lands', filters],
    queryFn: () =>
      getLands({
        ...(filters.search && { search: filters.search }),
        ...(filters.labelCode && { label: filters.labelCode }),
        ...(filters.status && { status: filters.status }),
        limit: 50,
      }).then(unwrap),
  });

  const payload = data as { data?: unknown[]; meta?: { total: number } } | null;
  const lands = payload?.data ?? (Array.isArray(data) ? data : []);
  const total = payload?.meta?.total ?? lands.length;

  const handleFilter = (key: string, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LandsFilters
          search={filters.search}
          labelCode={filters.labelCode}
          status={filters.status}
          onChange={handleFilter}
        />
        {admin && (
          <Link
            href="/lands/new"
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Nouveau terrain
          </Link>
        )}
      </div>

      <p className="text-sm text-gray-500">
        {total} terrain{total !== 1 ? 's' : ''} disponible{total !== 1 ? 's' : ''}
      </p>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : lands.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-gray-400">
          Aucun terrain trouvé.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(lands as Parameters<typeof LandCard>[0]['land'][]).map((land) => (
            <LandCard key={land.id} land={land} />
          ))}
        </div>
      )}
    </div>
  );
};
