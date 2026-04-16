import Link from 'next/link';
import { cn } from '@/lib/utils';

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  DOCS_RECEIVED: 'bg-purple-100 text-purple-700',
  PAYMENT_CONFIRMED: 'bg-indigo-100 text-indigo-700',
  DOSSIER_STARTED: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Acompte confirmé',
  DOCS_RECEIVED: 'Docs reçus',
  PAYMENT_CONFIRMED: 'Paiement confirmé',
  DOSSIER_STARTED: 'Dossier en cours',
  COMPLETED: 'Livré',
  CANCELLED: 'Annulé',
};

const LABEL_COLOR: Record<string, string> = {
  TDT: 'bg-blue-100 text-blue-700',
  VEFL: 'bg-amber-100 text-amber-700',
  VEFIL: 'bg-purple-100 text-purple-700',
};

const STEP_MAP: Record<string, number> = {
  PENDING: 1,
  CONFIRMED: 2,
  DOCS_RECEIVED: 3,
  PAYMENT_CONFIRMED: 4,
  DOSSIER_STARTED: 5,
  COMPLETED: 6,
  CANCELLED: 0,
};

const formatPrice = (p: number) => new Intl.NumberFormat('fr-FR').format(p);

interface Reservation {
  id: string;
  clientName: string;
  clientEmail: string;
  status: string;
  createdAt: string;
  land: {
    id: string;
    title: string;
    region: string;
    city?: string | null;
    price: number;
    sizeM2: number;
    label: { code: string };
  };
}

interface Props {
  reservation: Reservation;
  showAgent?: boolean;
}

export const ReservationCard = ({ reservation: r, showAgent }: Props) => {
  const step = STEP_MAP[r.status] ?? 0;
  const isCancelled = r.status === 'CANCELLED';

  return (
    <Link href={`/reservations/${r.id}`} className="group block">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="p-5">
          {/* Top row */}
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-xs font-bold',
                    LABEL_COLOR[r.land.label?.code] ?? 'bg-gray-100 text-gray-600',
                  )}
                >
                  {r.land.label?.code}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-500',
                  )}
                >
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>
              <h3 className="truncate font-semibold text-gray-900 group-hover:text-primary">
                {r.land.title}
              </h3>
              <p className="text-sm text-gray-500">{r.land.city ?? r.land.region}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-gray-900">{formatPrice(r.land.price)} F/m²</p>
              <p className="text-xs text-gray-400">{r.land.sizeM2?.toLocaleString('fr-FR')} m²</p>
            </div>
          </div>

          {/* Client */}
          <div className="mb-3 text-sm">
            <span className="text-gray-400">Client : </span>
            <span className="font-medium text-gray-700">{r.clientName}</span>
            {showAgent && <span className="ml-2 text-xs text-gray-400">{r.clientEmail}</span>}
          </div>

          {/* Progress bar */}
          {!isCancelled && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                <span>Étape {step}/6</span>
                <span>{Math.round((step / 6) * 100)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    step === 6 ? 'bg-green-500' : 'bg-primary',
                  )}
                  style={{ width: `${(step / 6) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Date */}
          <p className="mt-3 text-xs text-gray-400">
            Réservé le{' '}
            {new Date(r.createdAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>
    </Link>
  );
};
