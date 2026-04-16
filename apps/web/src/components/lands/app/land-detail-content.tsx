'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Maximize2, CheckCircle2, XCircle } from 'lucide-react';
import { getLandById } from '@/lib/actions/lands';
import { unwrap } from '@/lib/actions/unwrap';
import { Spinner } from '@/components/ui/spinner';
import { LandMap } from './land-map';
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

interface LandDetail {
  title: string;
  status: string;
  price: number;
  sizeM2: number;
  city?: string;
  region?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  isVerified?: boolean;
  tfNumber?: string;
  label?: { code: string; name?: string };
  media?: { url: string; order: number }[];
  features?: string[];
  documents?: { id: string; name: string; url: string }[];
}

const hasRole = (roles: string[], ...codes: string[]) => codes.some((c) => roles.includes(c));

const formatPrice = (p: number) => new Intl.NumberFormat('fr-FR').format(p);

interface Props {
  id: string;
}

export const LandDetailContent = ({ id }: Props) => {
  const { data: session } = useSession();
  const userRoles = (session?.user as { roles?: string[] })?.roles ?? [];
  const canReserve = hasRole(userRoles, 'AGENT', 'ADMIN_LANDS', 'ADMIN_GLOBAL');
  const isAdmin = hasRole(userRoles, 'ADMIN_LANDS', 'ADMIN_GLOBAL');

  const [activeImg, setActiveImg] = useState(0);

  const { data: land, isLoading } = useQuery<LandDetail>({
    queryKey: ['land', id],
    queryFn: () => getLandById(id).then(unwrap) as Promise<LandDetail>,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  if (!land) return null;

  const media = [...(land.media ?? [])].sort(
    (a: { order: number }, b: { order: number }) => a.order - b.order,
  );
  const cover = media[activeImg] ?? null;

  return (
    <div className="space-y-6">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href="/lands" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded border px-1.5 py-0.5 text-xs font-bold',
              LABEL_COLOR[land.label?.code ?? ''] ?? 'border-gray-200 bg-gray-100 text-gray-600',
            )}
          >
            {land.label?.code}
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
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left */}
        <div className="space-y-5">
          {/* Gallery */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
            <div className="relative h-64 sm:h-80">
              {cover ? (
                <img src={cover.url} alt={land.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  Aucune photo disponible
                </div>
              )}
            </div>
            {media.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {media.map((m: { url: string; order: number }, i: number) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={cn(
                      'h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                      activeImg === i ? 'border-primary' : 'border-transparent',
                    )}
                  >
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title + Location */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{land.title}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="size-4" />
              {[land.city, land.region].filter(Boolean).join(', ')}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">
                Superficie
              </p>
              <p className="mt-1 flex items-center gap-1 text-lg font-bold text-gray-900">
                <Maximize2 className="size-4 text-gray-400" />
                {land.sizeM2?.toLocaleString('fr-FR')} m²
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">Prix / m²</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{formatPrice(land.price)} F</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">
                Total estimé
              </p>
              <p className="mt-1 text-lg font-bold text-gray-900">
                {formatPrice(Math.round(land.price * land.sizeM2))} F
              </p>
            </div>
          </div>

          {/* Description */}
          {land.description && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">Description</h2>
              <p className="text-sm leading-relaxed text-gray-600">{land.description}</p>
            </div>
          )}

          {/* Map */}
          {land.latitude && land.longitude && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
                <MapPin className="size-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Localisation</h2>
              </div>
              <div className="h-64">
                <LandMap latitude={land.latitude} longitude={land.longitude} title={land.title} />
              </div>
            </div>
          )}

          {/* Features */}
          {land.features && land.features.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Caractéristiques</h2>
              <ul className="space-y-2">
                {land.features.map((f: string, i: number) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right — action panel */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-2xl font-bold text-gray-900">
                {formatPrice(land.price)} F
                <span className="text-base font-normal text-gray-400">/m²</span>
              </p>
              <p className="text-sm text-gray-500">
                {land.sizeM2?.toLocaleString('fr-FR')} m² • {land.label?.name ?? land.label?.code}
              </p>
            </div>

            {land.status === 'AVAILABLE' && canReserve ? (
              <Link
                href={`/lands/${id}/reserve`}
                className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
              >
                Réserver ce terrain
              </Link>
            ) : land.status === 'AVAILABLE' ? (
              <p className="rounded-xl bg-gray-50 px-4 py-3 text-center text-sm text-gray-500">
                Contactez un agent pour réserver
              </p>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
                <XCircle className="size-4" />
                {STATUS_LABEL[land.status] ?? land.status} — non disponible
              </div>
            )}
          </div>

          {/* Documents */}
          {land.documents && land.documents.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Documents</h2>
              <ul className="space-y-2">
                {land.documents.map((doc: { id: string; name: string; url: string }) => (
                  <li key={doc.id}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/5"
                    >
                      <span className="truncate">{doc.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Admin actions */}
          {isAdmin && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Actions admin</h2>
              <Link
                href={`/lands/${id}/edit`}
                className="flex w-full items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Modifier ce terrain
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
