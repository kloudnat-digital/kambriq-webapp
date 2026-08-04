'use client';

import type { FC } from 'react';
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date';
import type { LandReservationDetail } from '@/types/lands';

interface Step {
  label: string;
  description: string;
  doneAt?: string | null;
  action?: { label: string; key: string };
}

const buildSteps = (r: LandReservationDetail, t: (key: string) => string): Step[] => [
  {
    label: t('stepReservationLabel'),
    description: t('stepReservationDesc'),
    doneAt: r.createdAt,
  },
  {
    label: t('stepDepositLabel'),
    description: t('stepDepositDesc'),
    doneAt: r.confirmedAt,
    action: !r.confirmedAt ? { label: t('stepDepositAction'), key: 'confirm' } : undefined,
  },
  {
    label: t('stepDocsLabel'),
    description: t('stepDocsDesc'),
    doneAt: r.documentsReceivedAt,
    action:
      r.confirmedAt && !r.documentsReceivedAt
        ? { label: t('stepDocsAction'), key: 'documents-received' }
        : undefined,
  },
  {
    label: t('stepPaymentLabel'),
    description: t('stepPaymentDesc'),
    doneAt: r.remainingPaymentConfirmedAt,
    action:
      r.documentsReceivedAt && !r.remainingPaymentConfirmedAt
        ? { label: t('stepPaymentAction'), key: 'payment-confirmed' }
        : undefined,
  },
  {
    label: t('stepDossierLabel'),
    description: t('stepDossierDesc'),
    doneAt: r.dossierStartedAt,
    action:
      r.remainingPaymentConfirmedAt && !r.dossierStartedAt
        ? { label: t('stepDossierAction'), key: 'dossier-started' }
        : undefined,
  },
  {
    label: t('stepCompleteLabel'),
    description: t('stepCompleteDesc'),
    doneAt: r.completedAt,
    action:
      r.dossierStartedAt && !r.completedAt
        ? { label: t('stepCompleteAction'), key: 'complete' }
        : undefined,
  },
];

interface Props {
  reservation: LandReservationDetail;
  isAdmin: boolean;
  isCancelled: boolean;
  allClientDocsUploaded: boolean;
  onAction: (key: string) => void;
  actionPending: boolean;
  actionError: string | null;
}

export const ReservationTimeline: FC<Props> = ({
  reservation,
  isAdmin,
  isCancelled,
  allClientDocsUploaded,
  onAction,
  actionPending,
  actionError,
}) => {
  const t = useTranslations('app.reservations');
  const locale = useLocale();

  const steps = buildSteps(reservation, t);
  const currentStepIndex = steps.findIndex((s) => !s.doneAt);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-6">
      <h2 className="mb-5 text-sm font-semibold text-slate-900">{t('purchaseJourney')}</h2>
      <ol className="relative space-y-5">
        {steps.map((step, i) => {
          const done = !!step.doneAt;
          const active = !done && i === currentStepIndex && !isCancelled;
          const stepKey = step.action?.key ?? step.label;
          const gateDocs = step.action?.key === 'documents-received' && !allClientDocsUploaded;

          return (
            <li key={stepKey} className="relative flex gap-x-4">
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
                {step.action &&
                  isAdmin &&
                  !isCancelled &&
                  (() => {
                    const action = step.action;
                    return (
                      <>
                        <Button
                          size="sm"
                          type="button"
                          className="mt-2"
                          disabled={actionPending || gateDocs}
                          onClick={() => onAction(action.key)}
                        >
                          {actionPending && <Spinner className="size-3" />}
                          {action.label}
                        </Button>
                        {gateDocs && (
                          <p className="mt-1 text-xs text-slate-400">{t('clientDocsMissing')}</p>
                        )}
                      </>
                    );
                  })()}
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
  );
};
