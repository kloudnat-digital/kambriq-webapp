'use client';

import type { FC } from 'react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import {
  getReservationById,
  confirmReservationAction,
  markDocsReceivedAction,
  confirmPaymentAction,
  startDossierAction,
  completeReservationAction,
  cancelReservationAction,
  rejectClientDocumentAction,
} from '@/lib/actions/lands';
import { unwrap } from '@/lib/actions/unwrap';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { BreadcrumbNav } from '@/components/ui/breadcrumb-nav';
import {
  LAND_LABEL_CODE_STYLES,
  LAND_RESERVATION_STATUS_LABEL_KEYS,
  LAND_RESERVATION_STATUS_STYLES,
} from '@/constants/land';
import type { LandReservationDetail } from '@/types/lands';
import { ReservationTimeline } from './reservation-timeline';
import { ReservationClientInfoCard } from './reservation-client-info-card';
import { ReservationClientDocumentsPanel } from './reservation-client-documents-panel';
import { ReservationLandSummaryCard } from './reservation-land-summary-card';

const CancelReservationModal = dynamic(() =>
  import('./cancel-reservation-modal').then((m) => m.CancelReservationModal),
);

const RejectClientDocumentModal = dynamic(() =>
  import('./reject-client-document-modal').then((m) => m.RejectClientDocumentModal),
);

interface Props {
  id: string;
  currentUserId: string;
  isAdmin?: boolean;
}

const ReservationDetailContent: FC<Props> = ({ id, currentUserId, isAdmin = false }) => {
  const t = useTranslations('app.reservations');
  const qc = useQueryClient();

  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);

  const { data: r, isPending } = useQuery<LandReservationDetail>({
    queryKey: ['reservation', id],
    queryFn: () => getReservationById(id).then(unwrap) as Promise<LandReservationDetail>,
  });

  const stepActions: Record<string, () => Promise<unknown>> = {
    confirm: () => confirmReservationAction(id).then(unwrap),
    'documents-received': () => markDocsReceivedAction(id).then(unwrap),
    'payment-confirmed': () => confirmPaymentAction(id).then(unwrap),
    'dossier-started': () => startDossierAction(id).then(unwrap),
    complete: () => completeReservationAction(id).then(unwrap),
  };

  const actionMutation = useMutation({
    mutationFn: (key: string) => {
      const fn = stepActions[key];
      if (!fn) throw new Error(`Unknown step: ${key}`);
      return fn();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservation', id] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => cancelReservationAction(id, reason).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservation', id] });
      setIsCancelOpen(false);
    },
  });

  const rejectDocMutation = useMutation({
    mutationFn: ({ documentId, reason }: { documentId: string; reason: string }) =>
      rejectClientDocumentAction(id, documentId, reason).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservation', id] });
      setRejectDocId(null);
    },
  });

  if (isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  if (!r) return null;

  const isCancelled = r.status === 'CANCELLED';
  const isCompleted = r.status === 'COMPLETED';
  const canCancel = isAdmin || r.agentUserId === currentUserId;
  const requiredDocs = r.requiredDocuments;
  const uploadedCount = requiredDocs.filter((d) => d.uploaded).length;
  const allClientDocsUploaded = requiredDocs.length > 0 && uploadedCount === requiredDocs.length;

  const actionError = actionMutation.isError ? (actionMutation.error as Error).message : null;
  const cancelError = cancelMutation.isError ? (cancelMutation.error as Error).message : null;
  const rejectError = rejectDocMutation.isError ? (rejectDocMutation.error as Error).message : null;

  return (
    <div className="space-y-6">
      <div className="w-full rounded-md border border-slate-200 bg-white p-4">
        <BreadcrumbNav labels={{ [id]: r.land.title }} />
      </div>

      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Badge
            className={cn(
              'font-bold',
              LAND_LABEL_CODE_STYLES[r.land.label.code] ?? 'bg-slate-100 text-slate-600',
            )}
          >
            {r.land.label.code}
          </Badge>
          <Badge
            className={cn(
              'font-medium',
              LAND_RESERVATION_STATUS_STYLES[r.status] ?? 'bg-slate-100 text-slate-500',
            )}
          >
            {t(LAND_RESERVATION_STATUS_LABEL_KEYS[r.status])}
          </Badge>
        </div>
        <h1 className="truncate text-xl font-bold text-slate-900">{r.land.title}</h1>
        <p className="text-sm text-slate-500">{r.land.city ?? r.land.region}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <ReservationTimeline
          reservation={r}
          isAdmin={isAdmin}
          isCancelled={isCancelled}
          allClientDocsUploaded={allClientDocsUploaded}
          onAction={(key) => actionMutation.mutate(key)}
          actionPending={actionMutation.isPending}
          actionError={actionError}
        />

        <div className="space-y-4">
          <ReservationClientInfoCard
            clientName={r.clientName}
            clientEmail={r.clientEmail}
            clientPhone={r.clientPhone}
          />

          <ReservationClientDocumentsPanel
            requiredDocs={requiredDocs}
            uploadedCount={uploadedCount}
            isAdmin={isAdmin}
            onReject={setRejectDocId}
            rejectError={rejectError}
          />

          <ReservationLandSummaryCard
            land={{ id: r.land.id, price: r.land.price, sizeM2: r.land.sizeM2 }}
          />

          {!isCancelled && !isCompleted && canCancel && (
            <div className="space-y-1">
              <Button
                type="button"
                className="w-full"
                variant="destructive"
                onClick={() => setIsCancelOpen(true)}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending && <Spinner className="size-4" />}
                {t('cancelButton')}
              </Button>
              {cancelError && <p className="text-xs text-destructive">{cancelError}</p>}
            </div>
          )}
        </div>
      </div>

      <CancelReservationModal
        open={isCancelOpen}
        onOpenChange={setIsCancelOpen}
        onConfirm={(reason) => cancelMutation.mutate(reason)}
        isPending={cancelMutation.isPending}
      />

      <RejectClientDocumentModal
        open={!!rejectDocId}
        onOpenChange={(open) => !open && setRejectDocId(null)}
        onConfirm={(reason) =>
          rejectDocId && rejectDocMutation.mutate({ documentId: rejectDocId, reason })
        }
        isPending={rejectDocMutation.isPending}
      />
    </div>
  );
};

export default ReservationDetailContent;
