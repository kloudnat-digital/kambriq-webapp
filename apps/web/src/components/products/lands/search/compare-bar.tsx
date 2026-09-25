'use client';

import Image from 'next/image';
import { useRouter } from '@/i18n/navigation';
import { X, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { formatXAFCompact } from '@/lib/money';
import { useLandsSearchStore } from '@/store/lands-search.store';
import { MOCK_LANDS } from '@/data/mock-lands';

const MAX_COMPARE = 3;

export default function CompareBar() {
  const t = useTranslations('landSearch.compareBar');
  const router = useRouter();
  const { compareIds, toggleCompare, clearCompare } = useLandsSearchStore();

  if (compareIds.length === 0) return null;

  const lands = compareIds
    .map((id) => MOCK_LANDS.find((l) => l.id === id))
    .filter((l) => l !== undefined);

  return (
    <div className="fixed right-0 bottom-0 left-0 z-50 border-t border-border bg-white/95 shadow-lg backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-sm font-medium text-gray-700">
            {t('selected', { count: lands.length })}
          </span>

          <div className="flex flex-1 items-center gap-2 overflow-x-auto py-0.5">
            {/* Filled slots */}
            {lands.map((land) => (
              <div
                key={land.id}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-gray-50 px-2 py-1.5"
              >
                {land.media[0] && (
                  <div className="relative size-8 overflow-hidden rounded-md">
                    <Image
                      src={land.media[0].url}
                      alt={land.title}
                      fill
                      className="object-cover"
                      sizes="32px"
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="max-w-[120px] truncate text-xs font-medium text-gray-900">
                    {land.title}
                  </p>
                  <p className="text-xs text-primary-600">{formatXAFCompact(land.price)}</p>
                </div>
                <button
                  onClick={() => toggleCompare(land.id)}
                  className="ml-0.5 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: MAX_COMPARE - lands.length }).map((_, i) => (
              <div
                key={i}
                className="flex h-11 w-32 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-200 text-xs text-gray-400"
              >
                + {t('addLand')}
              </div>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button onClick={clearCompare} className="text-xs text-gray-500 hover:text-gray-700">
              {t('clear')}
            </button>
            <Button
              size="sm"
              disabled={lands.length < 2}
              className="h-8 gap-1.5 text-xs"
              onClick={() => router.push('/admin/lands/compare')}
            >
              {t('compare')}
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
