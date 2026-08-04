'use client';

import type { FC } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
}

export const ReservationClientInfoCard: FC<Props> = ({ clientName, clientEmail, clientPhone }) => {
  const t = useTranslations('app.reservations');

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{t('client')}</h2>
      <div className="space-y-2 text-sm">
        <div>
          <p className="text-xs text-slate-400">{t('name')}</p>
          <p className="font-medium text-slate-900">{clientName}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">{t('email')}</p>
          <p className="text-slate-700">{clientEmail}</p>
        </div>
        {clientPhone && (
          <div>
            <p className="text-xs text-slate-400">{t('phone')}</p>
            <p className="text-slate-700">{clientPhone}</p>
          </div>
        )}
      </div>
    </div>
  );
};
