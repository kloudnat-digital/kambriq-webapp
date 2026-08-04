'use client';

import { useQuery } from '@tanstack/react-query';
import { getMyPurchases } from '@/lib/actions/lands';
import { PurchaseCard } from './purchase-card';
import { Spinner } from '@/components/ui/spinner';
import { LayoutGrid } from 'lucide-react';
import { unwrap } from '@/lib/actions/unwrap';
import type { PaginatedResponse } from '@/types/api';
import type { ClientPurchase } from '@/types/lands';
import { useTranslations } from 'next-intl';

export function MyLandsContent() {
  const t = useTranslations('app.myLands');

  const { data, isPending } = useQuery({
    queryKey: ['my-purchases'],
    queryFn: () => getMyPurchases().then(unwrap),
  });

  console.log(data);

  const payload = data as PaginatedResponse<ClientPurchase> | null;
  const purchases = payload?.data ?? [];

  if (isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <LayoutGrid className="size-10 text-gray-300" />
        <p className="text-sm text-gray-500">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {purchases.map((r) => (
        <PurchaseCard key={r.id} reservation={r} />
      ))}
    </div>
  );
}
