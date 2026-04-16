'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Search } from 'lucide-react';
import { getReservations } from '@/lib/actions/lands';
import { unwrap } from '@/lib/actions/unwrap';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ReservationCard } from './reservation-card';
import { cn } from '@/lib/utils';

const STATUSES = [
  { value: '', label: 'Tous' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'CONFIRMED', label: 'Confirmé' },
  { value: 'DOCS_RECEIVED', label: 'Docs reçus' },
  { value: 'PAYMENT_CONFIRMED', label: 'Paiement' },
  { value: 'DOSSIER_STARTED', label: 'Dossier' },
  { value: 'COMPLETED', label: 'Livré' },
  { value: 'CANCELLED', label: 'Annulé' },
];

export const ReservationsContent = () => {
  const { data: session } = useSession();
  const userRoles = (session?.user as { roles?: string[] })?.roles ?? [];
  const isAdmin = userRoles.includes('ADMIN_LANDS') || userRoles.includes('ADMIN_GLOBAL');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reservations', search, status],
    queryFn: () => getReservations({ search, status, limit: 50 }).then(unwrap),
  });

  const payload = data as { data?: unknown[]; meta?: { total: number } } | null;
  const reservations = payload?.data ?? (Array.isArray(data) ? data : []);
  const total = payload?.meta?.total ?? reservations.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-55 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client, terrain…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
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

      <p className="text-sm text-gray-500">
        {total} réservation{total !== 1 ? 's' : ''}
      </p>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : reservations.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-gray-400">
          Aucune réservation trouvée.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(reservations as Parameters<typeof ReservationCard>[0]['reservation'][]).map((r) => (
            <ReservationCard key={r.id} reservation={r} showAgent={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
};
