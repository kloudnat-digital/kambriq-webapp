'use client';

import type { FC } from 'react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getLandById } from '@/lib/actions/lands';
import { unwrap } from '@/lib/actions/unwrap';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { BreadcrumbNav } from '@/components/ui/breadcrumb-nav';
import { LAND_LABEL_CODE_STYLES, LAND_STATUS_OPTION_KEYS } from '@/constants/land';
import type { LandDetail, LandLabelCode } from '@/types/lands';
import { LandGallery } from './land-gallery';
import { LandInfoPanel } from './land-info-panel';
import { LandDocuments } from './land-documents';
import { LandMap } from './land-map';
import { ReserveForm } from './reserve-form';

interface LandDetailContentProps {
  id: string;
  currentUserId: string;
  isAdmin: boolean;
  canManageReservations: boolean;
}

const LandDetailContent: FC<LandDetailContentProps> = ({
  id,
  currentUserId,
  isAdmin,
  canManageReservations,
}) => {
  const t = useTranslations('app.landDetail');

  const STATUS_LABEL = Object.fromEntries(
    LAND_STATUS_OPTION_KEYS.filter((o) => o.value).map((o) => [o.value, t(o.labelKey)]),
  );

  const { data: land } = useQuery<LandDetail>({
    queryKey: ['land', id],
    queryFn: () => getLandById(id).then(unwrap) as Promise<LandDetail>,
  });

  const media = useMemo(() => [...(land?.media ?? [])].sort((a, b) => a.order - b.order), [land]);

  const deposit = useMemo(
    () => Math.round(((land?.price ?? 0) * (land?.sizeM2 ?? 0) * 5) / 100),
    [land],
  );

  if (!land) return null;

  return (
    <div className="space-y-6">
      <div className="w-full rounded-md border border-slate-200 bg-white p-6">
        <BreadcrumbNav labels={{ [id]: land.title }} />
      </div>

      <div className="grid grid-cols-1 items-start gap-x-8 gap-y-8 lg:grid-cols-3">
        <div className="lg:col-start-3 lg:row-start-1">
          <LandInfoPanel land={land} />
          <ReserveForm
            key={land.reservations[0]?.id ?? 'new'}
            landId={id}
            deposit={deposit}
            className="mt-5 hidden lg:block"
            reservation={land.reservations[0]}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            canManageReservations={canManageReservations}
          />
        </div>

        <div className="lg:col-span-2 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <div className="flex w-full flex-col space-y-5 bg-white p-4 ring-1 ring-slate-900/5 sm:rounded-md">
            <LandGallery media={media} title={land.title} />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Badge
                  className={cn(
                    'rounded border font-bold',
                    LAND_LABEL_CODE_STYLES[(land.label?.code as LandLabelCode) ?? ''] ??
                      'border-gray-200 bg-gray-100 text-gray-600',
                  )}
                >
                  {land.label?.code}
                </Badge>
                <Badge className="font-medium">{STATUS_LABEL[land.status] ?? land.status}</Badge>
                {land.isVerified && (
                  <Badge className="bg-green-100 font-medium text-green-700">{t('verified')}</Badge>
                )}
              </div>
              <div className="mt-2.5">
                <h1 className="text-2xl font-bold text-slate-900">{land.title}</h1>
                <p className="text-sm font-medium text-slate-500">
                  {[land.neighborhood, land.city].filter(Boolean).join(', ')}
                  {land.region ? ` - ${land.region}` : ''}
                </p>
              </div>
              <div className="mt-4 text-sm text-slate-900">
                <p>{land.description}</p>
              </div>
            </div>
          </div>

          <LandDocuments documents={land.documents ?? []} />

          {land.latitude && land.longitude && (
            <div className="mt-5 flex flex-col bg-white p-4 ring-1 ring-slate-900/5 sm:rounded-md">
              <div className="pb-5">
                <h3 className="text-base font-semibold text-slate-900">{t('location')}</h3>
              </div>
              <div className="h-125">
                <LandMap latitude={land.latitude} longitude={land.longitude} title={land.title} />
              </div>
            </div>
          )}
        </div>

        <div className="block lg:hidden">
          <ReserveForm
            landId={id}
            deposit={deposit}
            reservation={land.reservations[0]}
            key={land.reservations[0]?.id ?? 'new'}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            canManageReservations={canManageReservations}
          />
        </div>
      </div>
    </div>
  );
};

export default LandDetailContent;
