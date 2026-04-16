'use client';

import Image from 'next/image';
import { MapPin, Maximize2, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { formatXAFCompact } from '@/lib/money';
import { useLandsSearchStore } from '@/store/lands-search.store';
import type { MockLand } from '@/data/mock-lands';

const LABEL_STYLES: Record<string, string> = {
  TDT: 'bg-primary-500/10 text-primary-700 border-primary-500/30',
  VEFL: 'bg-gold-500/10 text-gold-700 border-gold-500/30',
  VEFIL: 'bg-accent-500/10 text-accent-700 border-accent-500/30',
};

type LandCardProps = {
  land: MockLand;
  onDetails: (land: MockLand) => void;
};

export default function LandCard({ land, onDetails }: LandCardProps) {
  const t = useTranslations('landSearch');
  const { compareIds, toggleCompare } = useLandsSearchStore();
  const isComparing = compareIds.includes(land.id);
  const canAddMore = compareIds.length < 3;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Image */}
      <div className="relative h-48 overflow-hidden bg-gray-100">
        {land.media[0] && (
          <Image
            src={land.media[0].url}
            alt={land.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        )}

        {/* Label badge */}
        <div className="absolute top-3 left-3">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
              LABEL_STYLES[land.label.code] ?? 'border-gray-200 bg-gray-100 text-gray-700',
            )}
          >
            {land.label.code}
          </span>
        </div>

        {/* Verified badge */}
        {land.isVerified && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              <ShieldCheck className="size-3" />
              {t('verified')}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-1 text-sm font-semibold text-gray-900">{land.title}</h3>

        <div className="flex items-center gap-1 text-xs text-gray-500">
          <MapPin className="size-3.5 shrink-0" />
          <span>
            {land.city}, {land.region}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-gray-600">
            <Maximize2 className="size-3.5" />
            <span>{land.sizeM2.toLocaleString()} m²</span>
          </div>
          <span className="font-bold text-primary-600">{formatXAFCompact(land.price)}</span>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <Button size="sm" className="h-8 flex-1 text-xs" onClick={() => onDetails(land)}>
            {t('details')}
          </Button>

          <label
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors select-none',
              isComparing
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : !canAddMore
                  ? 'cursor-not-allowed border-gray-200 text-gray-400 opacity-60'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
            )}
          >
            <Checkbox
              checked={isComparing}
              disabled={!isComparing && !canAddMore}
              onCheckedChange={() => toggleCompare(land.id)}
              className="size-3.5"
            />
            {t('compare')}
          </label>
        </div>
      </div>
    </div>
  );
}
