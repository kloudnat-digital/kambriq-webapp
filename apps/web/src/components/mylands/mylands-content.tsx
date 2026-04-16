'use client';

import { useQuery } from '@tanstack/react-query';
import { getMyPurchases } from '@/lib/actions/lands';
import { PurchaseCard } from './purchase-card';
import { Spinner } from '@/components/ui/spinner';
import { LayoutGrid } from 'lucide-react';

export function MyLandsContent() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-purchases'],
    queryFn: () => getMyPurchases(),
  });

  const purchases = (data as { data?: unknown[] } | unknown[])
    ? Array.isArray(data)
      ? data
      : ((data as { data?: unknown[] })?.data ?? [])
    : [];

  if (isLoading) {
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
        <p className="text-sm text-gray-500">
          Vous n&apos;avez pas encore de terrain en cours d&apos;acquisition.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(purchases as Parameters<typeof PurchaseCard>[0]['reservation'][]).map((r) => (
        <PurchaseCard key={r.id} reservation={r} />
      ))}
    </div>
  );
}
