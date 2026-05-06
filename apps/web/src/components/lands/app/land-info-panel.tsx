'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { formatXAF } from '@/lib/money';
import type { LandDetail } from '@/types/lands';
import { formatDate } from '@/lib/date';

interface InfoRowProps {
  label: string;
  value: string;
}

const InfoRow = ({ label, value }: InfoRowProps) => (
  <div className="flex items-center justify-between">
    <p className="text-sm/6 text-slate-500">{label}</p>
    <p className="text-sm/6 font-medium text-slate-900">{value}</p>
  </div>
);

interface LandInfoPanelProps {
  land: LandDetail;
}

export const LandInfoPanel = ({ land }: LandInfoPanelProps) => {
  const t = useTranslations('app.landDetail');

  const locale = useLocale();

  return (
    <div className="rounded-md bg-white p-4 ring ring-slate-900/5">
      <div className="flex flex-col">
        <div className="pb-5">
          <h3 className="text-base font-semibold text-slate-900">{t('infoTitle')}</h3>
        </div>
        <div className="-mx-4 flex w-full flex-col gap-4 border-t border-slate-900/5 p-4">
          <InfoRow label={t('price')} value={`${formatXAF(land.price)}/m²`} />
          <InfoRow label={t('superficie')} value={`${land.sizeM2} m²`} />
          <InfoRow label={t('totalPrice')} value={formatXAF(land.price * land.sizeM2)} />
          <div className="flex items-center justify-between">
            <p className="text-sm/6 text-slate-500">{t('pointValue')}</p>
            <Badge variant="secondary">{land.pv}</Badge>
          </div>
          <InfoRow label={t('owner')} value={land.ownerType ?? '—'} />
          <div className="flex items-center justify-between">
            <p className="text-sm/6 text-slate-500">{t('labelTitle')}</p>
            <Badge variant="secondary" className="rounded-sm ring ring-slate-700">
              {land.label?.code}
            </Badge>
          </div>
          <InfoRow
            label={t('verifiedAt')}
            value={land.verifiedAt ? formatDate(land.verifiedAt, locale) : t('notVerified')}
          />
        </div>
      </div>
    </div>
  );
};
