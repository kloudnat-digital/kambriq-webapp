import Link from 'next/link';
import { cn } from '@/lib/utils';

const LABEL_COLOR: Record<string, string> = {
  TDT: 'bg-blue-100 text-blue-700 border-blue-200',
  VEFL: 'bg-amber-100 text-amber-700 border-amber-200',
  VEFIL: 'bg-purple-100 text-purple-700 border-purple-200',
};

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-700',
  RESERVED: 'bg-orange-100 text-orange-700',
  SOLD: 'bg-gray-100 text-gray-500',
  ARCHIVED: 'bg-gray-100 text-gray-400',
};

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Disponible',
  RESERVED: 'Réservé',
  SOLD: 'Vendu',
  ARCHIVED: 'Archivé',
};

interface LandCardProps {
  land: {
    id: string;
    title: string;
    region: string;
    city?: string | null;
    price: number;
    sizeM2: number;
    status: string;
    isVerified: boolean;
    label: { code: string; name: string };
    media?: Array<{ url: string; order: number }>;
  };
  href?: string;
}

const formatPrice = (p: number) => new Intl.NumberFormat('fr-FR').format(p);

export const LandCard = ({ land, href }: LandCardProps) => {
  const cover = land.media?.sort((a, b) => a.order - b.order)[0];

  return (
    <Link href={href ?? `/lands/${land.id}`} className="group block">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        {/* Thumbnail */}
        <div className="relative h-44 bg-gray-100">
          {cover ? (
            <img src={cover.url} alt={land.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Photo terrain
            </div>
          )}
          {land.status === 'RESERVED' && (
            <span className="absolute top-3 right-3 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">
              Réservé
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={cn(
                'rounded border px-1.5 py-0.5 text-xs font-bold',
                LABEL_COLOR[land.label.code] ?? 'border-gray-200 bg-gray-100 text-gray-600',
              )}
            >
              {land.label.code}
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                STATUS_BADGE[land.status] ?? 'bg-gray-100 text-gray-500',
              )}
            >
              {STATUS_LABEL[land.status] ?? land.status}
            </span>
            {land.isVerified && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Vérifié
              </span>
            )}
          </div>
          <h3 className="mb-0.5 truncate font-semibold text-gray-900 group-hover:text-primary">
            {land.title}
          </h3>
          <p className="mb-3 text-sm text-gray-500">{land.city ?? land.region}</p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-lg font-bold text-gray-900">{formatPrice(land.price)} F/m²</p>
            </div>
            <p className="text-sm text-gray-400">{land.sizeM2.toLocaleString('fr-FR')} m²</p>
          </div>
        </div>
      </div>
    </Link>
  );
};
