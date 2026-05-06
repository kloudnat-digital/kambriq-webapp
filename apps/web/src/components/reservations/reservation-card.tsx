'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import type { LandReservation } from '@/types/lands';
import { Badge } from '../ui/badge';
import { formatXAF } from '@/lib/money';
import {
  LAND_LABEL_CODE_STYLES,
  LAND_RESERVATION_STATUS_LABEL_KEYS,
  LAND_RESERVATION_STATUS_STYLES,
} from '@/constants/land';

const TOTAL_STEPS = 6;

interface Props {
  isAdmin: boolean;
  reservation: LandReservation;
}

export const ReservationCard = ({ reservation: r, isAdmin }: Props) => {
  const t = useTranslations('app.reservations');
  const locale = useLocale();

  const isCancelled = r.status === 'CANCELLED';

  const formattedDate = new Date(r.createdAt).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Link href={`/reservations/${r.id}`} className="group block">
      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <Badge
                  className={cn(
                    'rounded font-bold',
                    LAND_LABEL_CODE_STYLES[r.land.label?.code] ?? 'bg-gray-100 text-gray-600',
                  )}
                >
                  {r.land.label?.code}
                </Badge>
                <Badge
                  className={cn(
                    'font-medium',
                    LAND_RESERVATION_STATUS_STYLES[r.status] ?? 'bg-gray-100 text-gray-500',
                  )}
                >
                  {t(LAND_RESERVATION_STATUS_LABEL_KEYS[r.status])}
                </Badge>
              </div>
              <h3 className="truncate font-semibold text-gray-900 group-hover:text-primary">
                {r.land.title}
              </h3>
              <p className="text-sm text-gray-500">{r.land.city ?? r.land.region}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-gray-900">{formatXAF(r.land.price)} F/m²</p>
              <p className="text-xs text-gray-400">{r.land.sizeM2} m²</p>
            </div>
          </div>

          <div className="mb-3 text-sm">
            <span className="text-gray-400">{t('client')} : </span>
            <span className="font-medium text-gray-700">{r.clientName}</span>
            {isAdmin && <span className="ml-2 text-xs text-gray-400">{r.clientEmail}</span>}
          </div>

          {!isCancelled && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                <span>{t('step', { current: r.currentStep, total: TOTAL_STEPS })}</span>
                <span>{Math.round((r.currentStep / TOTAL_STEPS) * 100)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    r.currentStep === TOTAL_STEPS ? 'bg-primary-500' : 'bg-primary-600',
                  )}
                  style={{ width: `${(r.currentStep / TOTAL_STEPS) * 100}%` }}
                />
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-gray-400">{t('reservedOn', { date: formattedDate })}</p>
        </div>
      </div>
    </Link>
  );
};
