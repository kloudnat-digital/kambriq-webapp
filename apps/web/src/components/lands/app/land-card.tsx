'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { formatXAFCompact } from '@/lib/money';
import type { Land } from '@/types/lands';
import { LAND_LABEL_CODE_STYLES, LAND_STATUS_LABELS, LAND_STATUS_STYLES } from '@/constants/land';
import { Badge } from '@/components/ui/badge';
import type { FC } from 'react';

interface LandCardProps {
  land: Land;
  href?: string;
}

const LandCard: FC<LandCardProps> = ({ land, href }) => {
  const t = useTranslations('app.landCard');
  const cover = land.media?.[0];

  return (
    <Link href={href ?? `/lands/${land.id}`} className="group block">
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="relative h-44 bg-gray-100">
          {cover ? (
            <Image
              fill
              src={cover.url}
              alt={land.title}
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              {t('noPhoto')}
            </div>
          )}
          {land.status === 'RESERVED' && (
            <Badge className="absolute top-3 right-3 bg-orange-500 font-semibold text-white">
              {LAND_STATUS_LABELS['RESERVED']}
            </Badge>
          )}
        </div>

        <div className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge
              className={cn(
                'rounded border px-1.5 py-0.5 text-xs font-bold',
                LAND_LABEL_CODE_STYLES[land.label.code] ??
                  'border-gray-200 bg-gray-100 text-gray-600',
              )}
            >
              {land.label.code}
            </Badge>
            <Badge
              className={cn(
                'px-2 py-0.5 text-xs font-medium',
                LAND_STATUS_STYLES[land.status] ?? 'bg-gray-100 text-gray-500',
              )}
            >
              {LAND_STATUS_LABELS[land.status] ?? land.status}
            </Badge>
            {land.isVerified && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                {t('verified')}
              </span>
            )}
          </div>
          <h3 className="mb-0.5 truncate font-semibold text-gray-900 group-hover:text-primary">
            {land.title}
          </h3>
          <p className="mb-3 text-sm text-gray-500">{land.city ?? land.region}</p>
          <div className="flex items-end justify-between">
            <p className="text-lg font-bold text-gray-900">{formatXAFCompact(land.price)}/m²</p>
            <p className="text-sm text-gray-400">{land.sizeM2} m²</p>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default LandCard;
