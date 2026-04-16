'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';

import FiltersBar from './filters-bar';
import LandCard from './land-card';
import LandDetailModal from './land-detail-modal';
import CompareBar from './compare-bar';
import { useLandsSearchStore } from '@/store/lands-search.store';
import { MOCK_LANDS, type MockLand } from '@/data/mock-lands';

const LandsMap = dynamic(() => import('./lands-map'), { ssr: false });

export default function SearchContent() {
  const t = useTranslations('landSearch');
  const { filters } = useLandsSearchStore();
  const [selectedLand, setSelectedLand] = useState<MockLand | null>(null);

  const filteredLands = useMemo(() => {
    return MOCK_LANDS.filter((land) => {
      if (
        filters.search &&
        !land.title.toLowerCase().includes(filters.search.toLowerCase()) &&
        !land.city.toLowerCase().includes(filters.search.toLowerCase()) &&
        !land.neighborhood.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      if (filters.region && land.region !== filters.region) return false;
      if (filters.city && land.city !== filters.city) return false;
      if (filters.labelCode && land.label.code !== filters.labelCode) return false;
      if (filters.minPrice && land.price < Number(filters.minPrice)) return false;
      if (filters.maxPrice && land.price > Number(filters.maxPrice)) return false;
      if (filters.verifiedOnly && !land.isVerified) return false;
      return true;
    });
  }, [filters]);

  return (
    <>
      <div className="flex flex-col" style={{ height: 'calc(100svh - 73px)' }}>
        <FiltersBar />

        <div className="flex min-h-0 flex-1">
          {/* Map — hidden on mobile */}
          <div className="hidden border-r border-border md:block md:w-[50%]">
            <LandsMap lands={filteredLands} onLandClick={setSelectedLand} />
          </div>

          {/* Listings */}
          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
            <div className="shrink-0 border-b border-border bg-gray-50/60 px-4 py-2 sm:px-6">
              <p className="text-sm text-gray-500">
                {t('resultsCount', { count: filteredLands.length })}
              </p>
            </div>

            <div className="grid flex-1 auto-rows-max grid-cols-1 gap-4 p-4 pb-28 sm:grid-cols-2 sm:p-5">
              {filteredLands.map((land) => (
                <LandCard key={land.id} land={land} onDetails={setSelectedLand} />
              ))}

              {filteredLands.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                  <p className="text-base font-medium">{t('noResults')}</p>
                  <p className="mt-1 text-sm">{t('noResultsHint')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <LandDetailModal land={selectedLand} onClose={() => setSelectedLand(null)} />
      <CompareBar />
    </>
  );
}
