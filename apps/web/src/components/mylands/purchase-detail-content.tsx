'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { getPurchaseDetail } from '@/lib/actions/lands';
import { Spinner } from '@/components/ui/spinner';
import { JourneySteps } from './journey-steps';
import { PurchaseDocuments } from './purchase-documents';
import { cn } from '@/lib/utils';
import { LAND_LABEL_CODE_STYLES } from '@/constants/land';
import type { LandLabelCode } from '@/types/lands';

interface Props {
  id: string;
}

export function PurchaseDetailContent({ id }: Props) {
  const { data: r, isLoading } = useQuery({
    queryKey: ['purchase', id],
    queryFn: () => getPurchaseDetail(id),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  if (!r) return null;

  const reservation = r as unknown as {
    clientName: string;
    status: string;
    createdAt: string;
    confirmedAt: string | null;
    documentsReceivedAt: string | null;
    remainingPaymentConfirmedAt: string | null;
    dossierStartedAt: string | null;
    completedAt: string | null;
    land: {
      title: string;
      city?: string;
      region?: string;
      label: { code: string };
      documents?: { id: string; name: string; type: string; url: string }[];
    };
  };
  const whatsappUrl = `https://wa.me/?text=Bonjour, je suis ${reservation.clientName}, concernant ma réservation pour ${reservation.land.title}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/mylands" className="mt-0.5 text-gray-400 hover:text-gray-600">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-semibold',
                LAND_LABEL_CODE_STYLES[(reservation.land.label.code as LandLabelCode) ?? ''] ??
                  'bg-gray-100 text-gray-600',
              )}
            >
              {reservation.land.label.code}
            </span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{reservation.land.title}</h1>
          <p className="text-sm text-gray-500">
            {reservation.land.city ?? reservation.land.region}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left - journey */}
        <JourneySteps reservation={reservation} />

        {/* Right - documents + agent */}
        <div className="space-y-4">
          <PurchaseDocuments documents={reservation.land.documents ?? []} />

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Votre agent</h2>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#20bc5a]"
            >
              <MessageCircle className="size-4" />
              Contacter via WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
