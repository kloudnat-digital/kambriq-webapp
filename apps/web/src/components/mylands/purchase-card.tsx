import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { LandLabelCode, LandReservationStatus } from '@/types/lands';
import { Badge } from '../ui/badge';
import {
  LAND_LABEL_CODE_STYLES,
  LAND_RESERVATION_STATUS_LABEL_KEYS,
  LAND_RESERVATION_STATUS_STYLES,
  TOTAL_STEPS,
} from '@/constants/land';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/lib/date';
interface PurchaseCardProps {
  reservation: {
    id: string;
    agentUserId: string;
    status: LandReservationStatus;
    createdAt: string;
    currentStep: number;
    land: {
      id: string;
      title: string;
      region: string;
      city: string | null;
      price: number;
      sizeM2: number;
      label: { code: LandLabelCode; name: string };
    };
    agent: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}

export function PurchaseCard({ reservation: r }: PurchaseCardProps) {
  const t = useTranslations('app.reservations');
  const tMy = useTranslations('app.myLands');

  const locale = useLocale();

  const isCancelled = r.status === 'CANCELLED';

  return (
    <Link href={`/mylands/purchase/${r.id}`} className="group block">
      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-col gap-y-1">
                <Badge
                  className={cn(
                    'font-medium',
                    LAND_RESERVATION_STATUS_STYLES[r.status] ?? 'bg-gray-100 text-gray-500',
                  )}
                >
                  {t(LAND_RESERVATION_STATUS_LABEL_KEYS[r.status])}
                </Badge>
                <h3 className="truncate font-semibold text-gray-900 group-hover:text-primary">
                  {r.land.title}
                </h3>
                <p className="text-sm text-gray-500">{r.land.city ?? r.land.region}</p>
              </div>
            </div>
            <div className="shrink-0">
              <Badge
                className={cn(
                  'rounded font-bold',
                  LAND_LABEL_CODE_STYLES[r.land.label.code] ?? 'bg-gray-100 text-gray-600',
                )}
              >
                {r.land.label?.code}
              </Badge>
            </div>
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

          <div className="flex items-center justify-between">
            <p className="mt-3 text-xs text-gray-400">
              {t('reservedOn', { date: formatDate(r.createdAt, locale) })}
            </p>
            <p className="mt-3 text-xs text-gray-400">
              {tMy('agentLabel')}: {r.agent.firstName} {r.agent.lastName}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
