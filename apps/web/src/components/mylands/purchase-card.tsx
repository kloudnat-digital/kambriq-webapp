import Link from 'next/link';
import { cn } from '@/lib/utils';

type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

const STATUS_CONFIG: Record<ReservationStatus, { label: string; color: string; step: number }> = {
  PENDING: { label: 'Acompte en attente', color: 'bg-amber-100 text-amber-700', step: 1 },
  CONFIRMED: { label: 'En cours', color: 'bg-blue-100 text-blue-700', step: 3 },
  COMPLETED: { label: 'Terminé', color: 'bg-green-100 text-green-700', step: 6 },
  CANCELLED: { label: 'Annulée', color: 'bg-red-100 text-red-700', step: 0 },
};

const LABEL_COLOR: Record<string, string> = {
  TDT: 'bg-blue-100 text-blue-700',
  VEFL: 'bg-amber-100 text-amber-700',
  VEFIL: 'bg-purple-100 text-purple-700',
};

interface PurchaseCardProps {
  reservation: {
    id: string;
    status: ReservationStatus;
    createdAt: string;
    agentUserId: string;
    documentsReceivedAt: string | null;
    remainingPaymentConfirmedAt: string | null;
    dossierStartedAt: string | null;
    completedAt: string | null;
    land: {
      id: string;
      title: string;
      region: string;
      city?: string | null;
      price: number;
      sizeM2: number;
      label: { code: string; name: string };
    };
  };
}

function getStep(r: PurchaseCardProps['reservation']): number {
  if (r.status === 'CANCELLED') return 0;
  if (r.completedAt) return 6;
  if (r.dossierStartedAt) return 5;
  if (r.remainingPaymentConfirmedAt) return 4;
  if (r.documentsReceivedAt) return 3;
  if (r.status === 'CONFIRMED') return 2;
  return 1;
}

export function PurchaseCard({ reservation: r }: PurchaseCardProps) {
  const config = STATUS_CONFIG[r.status];
  const step = getStep(r);
  const progress = r.status === 'CANCELLED' ? 0 : Math.round((step / 6) * 100);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-semibold',
                LABEL_COLOR[r.land.label.code] ?? 'bg-gray-100 text-gray-600',
              )}
            >
              {r.land.label.code}
            </span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', config.color)}>
              {config.label}
            </span>
          </div>
          <h3 className="truncate text-base font-semibold text-gray-900">{r.land.title}</h3>
          <p className="text-sm text-gray-500">{r.land.city ?? r.land.region}</p>
        </div>
      </div>

      {r.status !== 'CANCELLED' && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>Étape {step}/6</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                r.status === 'COMPLETED' ? 'bg-green-500' : 'bg-primary',
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Réservé le{' '}
          {new Date(r.createdAt).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
        {r.status !== 'CANCELLED' && (
          <Link
            href={`/mylands/purchase/${r.id}`}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
          >
            {r.status === 'COMPLETED' ? 'Voir les documents' : 'Voir le suivi'}
          </Link>
        )}
      </div>
    </div>
  );
}
