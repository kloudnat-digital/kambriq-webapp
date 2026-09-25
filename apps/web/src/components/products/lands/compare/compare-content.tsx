'use client';

import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { useLandsSearchStore } from '@/store/lands-search.store';
import { MOCK_LANDS } from '@/data/mock-lands';
import { CompareEmpty } from './compare-empty';
import { CompareTable } from './compare-table';
import { CompareCards } from './compare-cards';

export const CompareContent = () => {
  const t = useTranslations('landsCompare');
  const { compareIds, clearCompare } = useLandsSearchStore();

  const lands = compareIds
    .map((id) => MOCK_LANDS.find((l) => l.id === id))
    .filter((l) => l !== undefined);

  if (lands.length < 2) return <CompareEmpty />;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/admin/lands/search">
              <ArrowLeft className="size-4" />
              {t('backToSearch')}
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('subtitle', { count: lands.length })}</p>
        </div>
        <Button variant="outline" onClick={() => clearCompare()} className="shrink-0">
          {t('clearAndRestart')}
        </Button>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block">
        <CompareTable lands={lands} />
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden">
        <CompareCards lands={lands} />
      </div>
    </div>
  );
};
