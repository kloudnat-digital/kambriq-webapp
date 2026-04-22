'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, Circle, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getReservationById, reservationAction, cancelReservation } from '@/lib/actions/lands';
import { unwrap } from '@/lib/actions/unwrap';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const hasRole = (roles: string[], ...codes: string[]) => codes.some((c) => roles.includes(c));

const STATUS_LABEL_STATIC: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Acompte confirmé',
  DOCS_RECEIVED: 'Documents reçus',
  PAYMENT_CONFIRMED: 'Paiement confirmé',
  DOSSIER_STARTED: 'Dossier en cours',
  COMPLETED: 'Livré',
  CANCELLED: 'Annulé',
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  DOCS_RECEIVED: 'bg-purple-100 text-purple-700',
  PAYMENT_CONFIRMED: 'bg-indigo-100 text-indigo-700',
  DOSSIER_STARTED: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const LABEL_COLOR: Record<string, string> = {
  TFL: 'bg-blue-100 text-blue-700',
  VEFL: 'bg-amber-100 text-amber-700',
  VEFIL: 'bg-purple-100 text-purple-700',
};

interface ReservationDetail {
  status: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  createdAt: string;
  confirmedAt: string | null;
  documentsReceivedAt: string | null;
  remainingPaymentConfirmedAt: string | null;
  dossierStartedAt: string | null;
  completedAt: string | null;
  land?: {
    id: string;
    title: string;
    city?: string;
    region?: string;
    price: number;
    sizeM2: number;
    label?: { code: string };
  };
}

interface Step {
  label: string;
  description: string;
  doneAt?: string | null;
  action?: {
    label: string;
    key: string; // matches the API path segment: confirm | documents-received | payment-confirmed | dossier-started | complete
  };
}

const buildSteps = (r: ReservationDetail): Step[] => {
  return [
    {
      label: 'Réservation',
      description: "Terrain réservé par l'agent",
      doneAt: r.createdAt as string,
    },
    {
      label: 'Validation acompte',
      description: "Confirmation du versement de l'acompte (5%)",
      doneAt: r.confirmedAt as string | null,
      action: !r.confirmedAt ? { label: "Confirmer l'acompte", key: 'confirm' } : undefined,
    },
    {
      label: 'Documents clients',
      description: 'Réception des documents requis du client',
      doneAt: r.documentsReceivedAt as string | null,
      action:
        r.confirmedAt && !r.documentsReceivedAt
          ? { label: 'Marquer docs reçus', key: 'documents-received' }
          : undefined,
    },
    {
      label: 'Paiements restants',
      description: 'Confirmation du solde total',
      doneAt: r.remainingPaymentConfirmedAt as string | null,
      action:
        r.documentsReceivedAt && !r.remainingPaymentConfirmedAt
          ? { label: 'Confirmer paiement', key: 'payment-confirmed' }
          : undefined,
    },
    {
      label: 'Avancement dossier',
      description: 'Transfert de titre en cours',
      doneAt: r.dossierStartedAt as string | null,
      action:
        r.remainingPaymentConfirmedAt && !r.dossierStartedAt
          ? { label: 'Démarrer le dossier', key: 'dossier-started' }
          : undefined,
    },
    {
      label: 'Livraison documents',
      description: 'Documents finaux remis au client',
      doneAt: r.completedAt as string | null,
      action:
        r.dossierStartedAt && !r.completedAt
          ? { label: 'Finaliser la vente', key: 'complete' }
          : undefined,
    },
  ];
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

interface Props {
  id: string;
}

export const ReservationDetailContent = ({ id }: Props) => {
  const t = useTranslations('app.reservations');
  const { data: session } = useSession();
  const userRoles = (session?.user as { roles?: string[] })?.roles ?? [];
  const isAdmin = hasRole(userRoles, 'ADMIN_LANDS', 'ADMIN_GLOBAL');

  const qc = useQueryClient();
  const [actionError, setActionError] = useState('');

  const { data: r, isLoading } = useQuery<ReservationDetail>({
    queryKey: ['reservation', id],
    queryFn: () => getReservationById(id).then(unwrap) as Promise<ReservationDetail>,
  });

  const actionMutation = useMutation({
    mutationFn: (action: string) => reservationAction(id, action).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservation', id] });
      setActionError('');
    },
    onError: (err: unknown) => {
      setActionError((err as Error)?.message ?? 'Une erreur est survenue');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelReservation(id, 'Annulation demandée').then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservation', id] }),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  if (!r) return null;

  const steps = buildSteps(r);
  const isCancelled = r.status === 'CANCELLED';
  const isCompleted = r.status === 'COMPLETED';

  const currentStep = steps.findIndex((s) => !s.doneAt);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/reservations" className="mt-0.5 text-gray-400 hover:text-gray-600">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-xs font-bold',
                LABEL_COLOR[r.land?.label?.code ?? ''] ?? 'bg-gray-100 text-gray-600',
              )}
            >
              {r.land?.label?.code}
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-500',
              )}
            >
              {STATUS_LABEL_STATIC[r.status] ?? r.status}
            </span>
          </div>
          <h1 className="truncate text-xl font-bold text-gray-900">{r.land?.title}</h1>
          <p className="text-sm text-gray-500">{r.land?.city ?? r.land?.region}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Journey */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-sm font-semibold text-gray-900">{t('purchaseJourney')}</h2>
          <ol className="relative space-y-0">
            {steps.map((step, i) => {
              const done = !!step.doneAt;
              const active = !done && i === currentStep && !isCancelled;
              return (
                <li key={i} className="relative flex gap-4 pb-8 last:pb-0">
                  {/* Connector */}
                  {i < steps.length - 1 && (
                    <div
                      className={cn(
                        'absolute top-6 left-2.75 h-full w-0.5',
                        done ? 'bg-green-400' : 'bg-gray-200',
                      )}
                    />
                  )}
                  {/* Icon */}
                  <div className="relative z-10 shrink-0">
                    {done ? (
                      <CheckCircle2 className="size-6 text-green-500" />
                    ) : active ? (
                      <Clock className="size-6 text-primary" />
                    ) : (
                      <Circle className="size-6 text-gray-300" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        done ? 'text-gray-900' : active ? 'text-primary' : 'text-gray-400',
                      )}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-gray-400">{step.description}</p>
                    {step.doneAt && (
                      <p className="mt-0.5 text-xs text-gray-500">{formatDate(step.doneAt)}</p>
                    )}
                    {step.action && isAdmin && !isCancelled && (
                      <button
                        onClick={() => actionMutation.mutate(step.action?.key ?? '')}
                        disabled={actionMutation.isPending}
                        className="mt-2 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                      >
                        {actionMutation.isPending && <Spinner className="size-3" />}
                        {step.action.label}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {actionError && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {actionError}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Client info */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('client')}</h2>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-gray-400">{t('name')}</p>
                <p className="font-medium text-gray-900">{r.clientName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">{t('email')}</p>
                <p className="text-gray-700">{r.clientEmail}</p>
              </div>
              {r.clientPhone && (
                <div>
                  <p className="text-xs text-gray-400">{t('phone')}</p>
                  <p className="text-gray-700">{r.clientPhone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Land info */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('land')}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Prix / m²</span>
                <span className="font-medium text-gray-900">
                  {new Intl.NumberFormat('fr-FR').format(r.land?.price ?? 0)} F
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t('size')}</span>
                <span className="font-medium text-gray-900">
                  {r.land?.sizeM2?.toLocaleString('fr-FR')} m²
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2">
                <span className="text-gray-400">{t('total')}</span>
                <span className="font-bold text-gray-900">
                  {new Intl.NumberFormat('fr-FR').format(
                    (r.land?.price ?? 0) * (r.land?.sizeM2 ?? 0),
                  )}{' '}
                  F
                </span>
              </div>
            </div>
            <Link
              href={`/lands/${r.land?.id}`}
              className="mt-3 block rounded-lg border border-gray-200 px-3 py-2 text-center text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Voir la fiche terrain
            </Link>
          </div>

          {/* Cancel */}
          {!isCancelled && !isCompleted && isAdmin && (
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
            >
              {cancelMutation.isPending && <Spinner className="size-4" />}
              Annuler la réservation
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
