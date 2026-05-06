'use client';

import type { FC } from 'react';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { CheckCircle2, Clock, Circle, AlertCircle } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import {
  getReservationById,
  confirmReservationAction,
  markDocsReceivedAction,
  confirmPaymentAction,
  startDossierAction,
  completeReservationAction,
  cancelReservationAction,
} from '@/lib/actions/lands';
import { unwrap } from '@/lib/actions/unwrap';
import { formatDate } from '@/lib/date';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { formatXAF } from '@/lib/money';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { BreadcrumbNav } from '@/components/ui/breadcrumb-nav';
import {
  LAND_LABEL_CODE_STYLES,
  LAND_RESERVATION_STATUS_LABEL_KEYS,
  LAND_RESERVATION_STATUS_STYLES,
} from '@/constants/land';
import type { LandReservationDetail } from '@/types/lands';
import { CancelReservationModal } from './cancel-reservation-modal';

interface Step {
  label: string;
  description: string;
  doneAt?: string | null;
  action?: {
    label: string;
    key: string;
  };
}

interface ReservationDetailContentProps {
  id: string;
  currentUserId: string;
  isAdmin?: boolean;
}

const buildSteps = (r: LandReservationDetail, t: (key: string) => string): Step[] => [
  {
    label: t('stepReservationLabel'),
    description: t('stepReservationDesc'),
    doneAt: r.createdAt as string,
  },
  {
    label: t('stepDepositLabel'),
    description: t('stepDepositDesc'),
    doneAt: r.confirmedAt as string | null,
    action: !r.confirmedAt ? { label: t('stepDepositAction'), key: 'confirm' } : undefined,
  },
  {
    label: t('stepDocsLabel'),
    description: t('stepDocsDesc'),
    doneAt: r.documentsReceivedAt as string | null,
    action:
      r.confirmedAt && !r.documentsReceivedAt
        ? { label: t('stepDocsAction'), key: 'documents-received' }
        : undefined,
  },
  {
    label: t('stepPaymentLabel'),
    description: t('stepPaymentDesc'),
    doneAt: r.remainingPaymentConfirmedAt as string | null,
    action:
      r.documentsReceivedAt && !r.remainingPaymentConfirmedAt
        ? { label: t('stepPaymentAction'), key: 'payment-confirmed' }
        : undefined,
  },
  {
    label: t('stepDossierLabel'),
    description: t('stepDossierDesc'),
    doneAt: r.dossierStartedAt as string | null,
    action:
      r.remainingPaymentConfirmedAt && !r.dossierStartedAt
        ? { label: t('stepDossierAction'), key: 'dossier-started' }
        : undefined,
  },
  {
    label: t('stepCompleteLabel'),
    description: t('stepCompleteDesc'),
    doneAt: r.completedAt as string | null,
    action:
      r.dossierStartedAt && !r.completedAt
        ? { label: t('stepCompleteAction'), key: 'complete' }
        : undefined,
  },
];

const ReservationDetailContent: FC<ReservationDetailContentProps> = ({
  id,
  currentUserId,
  isAdmin,
}) => {
  const t = useTranslations('app.reservations');
  const locale = useLocale();

  const qc = useQueryClient();
  const [actionError, setActionError] = useState('');
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const { data: r } = useQuery<LandReservationDetail>({
    queryKey: ['reservation', id],
    queryFn: () => getReservationById(id).then(unwrap) as Promise<LandReservationDetail>,
  });

  const STEP_ACTIONS = useMemo<Record<string, () => Promise<unknown>>>(
    () => ({
      confirm: () => confirmReservationAction(id).then(unwrap),
      'documents-received': () => markDocsReceivedAction(id).then(unwrap),
      'payment-confirmed': () => confirmPaymentAction(id).then(unwrap),
      'dossier-started': () => startDossierAction(id).then(unwrap),
      complete: () => completeReservationAction(id).then(unwrap),
    }),
    [id],
  );

  const steps = useMemo(() => (r ? buildSteps(r, t) : []), [r, t]);

  const actionMutation = useMutation({
    mutationFn: (key: string) => {
      const fn = STEP_ACTIONS[key];
      if (!fn) throw new Error(`Unknown step: ${key}`);
      return fn();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservation', id] });
      qc.invalidateQueries({ queryKey: ['reservations'] });
      setActionError('');
    },
    onError: (err: unknown) => {
      setActionError((err as Error)?.message ?? t('error'));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => cancelReservationAction(id, reason).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservation', id] });
      setIsCancelOpen(false);
    },
    onError: (err: unknown) => {
      setActionError((err as Error)?.message ?? t('error'));
    },
  });

  if (!r) return null;

  const isCancelled = r.status === 'CANCELLED';
  const isCompleted = r.status === 'COMPLETED';
  const currentStep = steps.findIndex((s) => !s.doneAt);
  const canCancel = isAdmin || r.agentUserId === currentUserId;

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
              LAND_LABEL_CODE_STYLES[r.land.label?.code] ?? 'bg-slate-100 text-slate-600',
            )}
          >
            {r.land?.label?.code}
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
        <h1 className="truncate text-xl font-bold text-slate-900">{r.land?.title}</h1>
        <p className="text-sm text-slate-500">{r.land?.city ?? r.land?.region}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-md border border-slate-200 bg-white p-6">
          <h2 className="mb-5 text-sm font-semibold text-slate-900">{t('purchaseJourney')}</h2>
          <ol className="relative space-y-5">
            {steps.map((step, i) => {
              const done = !!step.doneAt;
              const active = !done && i === currentStep && !isCancelled;
              return (
                <li key={i} className="relative flex gap-x-4">
                  <div
                    className={cn(
                      i === steps.length - 1 ? 'h-8' : '-bottom-8',
                      'absolute top-0 left-0 flex w-8 justify-center',
                    )}
                  >
                    <div className={cn(done ? 'bg-primary-500' : 'bg-slate-200', 'w-px')} />
                  </div>
                  <div className="relative -mx-1 flex size-10 flex-none items-center justify-center bg-white">
                    <span
                      className={cn(
                        done
                          ? 'bg-primary-700 text-primary-200 outline-primary-500'
                          : active
                            ? 'bg-amber-700 text-amber-200 outline-amber-500'
                            : 'bg-slate-200 text-slate-100 outline-slate-300',
                        'flex size-8 items-center justify-center rounded-full outline',
                      )}
                    >
                      {done ? (
                        <CheckCircle2 className="size-6" />
                      ) : active ? (
                        <Clock className="size-6" />
                      ) : (
                        <Circle className="size-6" />
                      )}
                    </span>
                  </div>
                  <div className="flex-auto rounded-md p-3 ring-1 ring-slate-200 ring-inset">
                    <div
                      className={cn(
                        'py-0.5 text-sm/5 font-medium',
                        done ? 'text-slate-900' : active ? 'text-primary-500' : 'text-slate-400',
                      )}
                    >
                      {step.label}
                    </div>
                    <p className="text-sm/6 text-slate-500">{step.description}</p>
                    {step.doneAt && (
                      <p className="mt-0.5 text-xs/6 text-slate-500">
                        {formatDate(step.doneAt, locale)}
                      </p>
                    )}
                    {step.action && isAdmin && !isCancelled && (
                      <Button
                        size="sm"
                        type="button"
                        className="mt-2"
                        disabled={actionMutation.isPending}
                        onClick={() => actionMutation.mutate(step.action?.key ?? '')}
                      >
                        {actionMutation.isPending && <Spinner className="size-3" />}
                        {step.action.label}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {actionError && (
            <Alert className="mt-4 rounded-md" variant="destructive">
              <AlertCircle />
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">{t('client')}</h2>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-slate-400">{t('name')}</p>
                <p className="font-medium text-slate-900">{r.clientName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t('email')}</p>
                <p className="text-slate-700">{r.clientEmail}</p>
              </div>
              {r.clientPhone && (
                <div>
                  <p className="text-xs text-slate-400">{t('phone')}</p>
                  <p className="text-slate-700">{r.clientPhone}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">{t('land')}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">{t('pricePerSqm')}</span>
                <span className="font-medium text-slate-900">{formatXAF(r.land?.price ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t('size')}</span>
                <span className="font-medium text-slate-900">{r.land?.sizeM2} m²</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="text-slate-400">{t('total')}</span>
                <span className="font-bold text-slate-900">
                  {formatXAF((r.land?.price ?? 0) * (r.land?.sizeM2 ?? 0))}
                </span>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="mt-3 w-full">
              <Link href={`/lands/${r.land.id}`}>{t('viewLand')}</Link>
            </Button>
          </div>

          {!isCancelled && !isCompleted && canCancel && (
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
          )}
        </div>
      </div>

      <CancelReservationModal
        open={isCancelOpen}
        onOpenChange={setIsCancelOpen}
        onConfirm={(reason) => cancelMutation.mutate(reason)}
        isPending={cancelMutation.isPending}
      />
    </div>
  );
};

export default ReservationDetailContent;
