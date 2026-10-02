'use client';

import type { FC } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatXAF } from '@/lib/money';

interface Props {
  land: {
    id: string;
    totalPrice: number;
    pricePerM2: number | null;
    sizeM2: number;
  };
  /** C49: what this reservation buys and costs - the money reads the sale, not the parcel. */
  sale: { purchasedM2: number; saleAmount: number };
}

export const ReservationLandSummaryCard: FC<Props> = ({ land, sale }) => {
  const t = useTranslations('app.reservations');

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{t('land')}</h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">{t('pricePerSqm')}</span>
          <span className="font-medium text-slate-900">
            {land.pricePerM2 === null ? '—' : formatXAF(land.pricePerM2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">{t('size')}</span>
          <span className="font-medium text-slate-900">
            {sale.purchasedM2 === land.sizeM2
              ? `${land.sizeM2} m²`
              : `${sale.purchasedM2} m² / ${land.sizeM2} m²`}
          </span>
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-2">
          <span className="text-slate-400">{t('total')}</span>
          <span className="font-bold text-slate-900">{formatXAF(sale.saleAmount)}</span>
        </div>
      </div>
      <Button asChild size="sm" variant="outline" className="mt-3 w-full">
        <Link href={`/lands/${land.id}`}>{t('viewLand')}</Link>
      </Button>
    </div>
  );
};
