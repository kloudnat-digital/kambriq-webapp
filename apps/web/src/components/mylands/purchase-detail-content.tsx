'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Clock, MailIcon, PhoneIcon } from 'lucide-react';
import {
  deleteClientDocumentAction,
  getClientDocumentUploadUrlAction,
  getPurchaseDetail,
  registerClientDocumentAction,
} from '@/lib/actions/lands';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import {
  LAND_LABEL_CODE_STYLES,
  LAND_RESERVATION_STATUS_LABEL_KEYS,
  LAND_RESERVATION_STATUS_STYLES,
} from '@/constants/land';
import { useLocale, useTranslations } from 'next-intl';
import { unwrap } from '@/lib/actions/unwrap';
import { useMemo, useState } from 'react';
import { formatDate } from '@/lib/date';
import { formatXAF } from '@/lib/money';
import { Button } from '../ui/button';
import { BreadcrumbNav } from '../ui/breadcrumb-nav';
import { Badge } from '../ui/badge';
import type { ClientPurchaseDetail, LandClientDocumentType } from '@/types/lands';
import { Label } from '../ui/label';
import { RequestPaymentCard } from './request-payment-card';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

interface Step {
  label: string;
  description: string;
  doneAt?: string | null;
}

interface Props {
  id: string;
}

const buildSteps = (
  r: ClientPurchaseDetail,
  tMy: (key: string, values?: Record<string, string | number>) => string,
): Step[] => {
  const agentName = `${r.agent.firstName} ${r.agent.lastName}`;
  const deposit = formatXAF(r.downPaymentAmount);
  // G20: before the deposit is confirmed, the balance line announces the balance
  // expected; once it is confirmed, what is actually still owed, from the ledger,
  // so a deposit received short shows here instead of vanishing.
  const remainingAmount = formatXAF(
    r.downPaymentConfirmed ? r.money.balanceOwed : r.money.balanceExpected,
  );
  const requiredCount = r.requiredDocuments.length;
  const uploadedCount = r.requiredDocuments.filter((d) => d.uploaded).length;
  const remainingDocs = requiredCount - uploadedCount;

  return [
    {
      label: tMy('steps.reservationLabel'),
      description: tMy('steps.reservationDesc', { agentName }),
      doneAt: r.createdAt,
    },
    {
      label: tMy('steps.depositLabel'),
      description: r.confirmedAt
        ? tMy('steps.depositConfirmedDesc', { amount: deposit })
        : tMy('steps.depositPendingDesc', { amount: deposit }),
      doneAt: r.confirmedAt,
    },
    {
      label: tMy('steps.docsLabel'),
      description: r.documentsReceivedAt
        ? tMy('steps.docsConfirmedDesc')
        : remainingDocs === 0
          ? tMy('steps.docsUploadedDesc')
          : tMy('steps.docsPendingDesc', { remaining: remainingDocs }),
      doneAt: r.documentsReceivedAt,
    },
    {
      label: tMy('steps.paymentLabel'),
      description: r.remainingPaymentConfirmedAt
        ? tMy('steps.paymentConfirmedDesc')
        : tMy('steps.paymentPendingDesc', { amount: remainingAmount }),
      doneAt: r.remainingPaymentConfirmedAt,
    },
    {
      label: tMy('steps.dossierLabel'),
      description: tMy('steps.dossierDesc'),
      doneAt: r.dossierStartedAt,
    },
    {
      label: tMy('steps.completeLabel'),
      description: tMy('steps.completeDesc'),
      doneAt: r.completedAt,
    },
  ];
};

export function PurchaseDetailContent({ id }: Props) {
  const t = useTranslations('app.reservations');
  const tMy = useTranslations('app.myLands');
  const locale = useLocale();
  const qc = useQueryClient();
  const { data: r, isPending } = useQuery<ClientPurchaseDetail>({
    queryKey: ['purchase', id],
    queryFn: () => getPurchaseDetail(id).then(unwrap) as Promise<ClientPurchaseDetail>,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ type, file }: { type: LandClientDocumentType; file: File }) => {
      const presigned = (await getClientDocumentUploadUrlAction(id, {
        type,
        filename: file.name,
        contentType: file.type,
      }).then(unwrap)) as { uploadUrl: string; fileUrl: string };

      const putRes = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error('S3 upload failed');

      return registerClientDocumentAction(id, {
        type,
        url: presigned.fileUrl,
        name: file.name,
      }).then(unwrap);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase', id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => deleteClientDocumentAction(id, documentId).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase', id] }),
  });

  const steps = useMemo(() => (r ? buildSteps(r, tMy) : []), [r, tMy]);
  const [sizeError, setSizeError] = useState(false);

  if (isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  if (!r) return null;

  const waPhone = (r.agent.phone ?? '').replace(/\D/g, '');
  const whatsappUrl = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(
        `Bonjour ${r.agent.firstName}, je suis ${r.clientName}, concernant ma réservation pour ${r.land.title}`,
      )}`
    : null;

  const isCancelled = r.status === 'CANCELLED';
  const currentStep = steps.findIndex((s) => !s.doneAt);
  const initials = `${r.agent.firstName[0] ?? ''}${r.agent.lastName[0] ?? ''}`.toUpperCase();
  const kambriqDocs = r.land.documents ?? [];

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

      {/*
        G9: the acompte step showed an amount and offered nothing to press.
        Hidden once the deposit is confirmed, and on a cancelled reservation -
        there is nothing to pay in either case.
      */}
      {!isCancelled && !r.downPaymentConfirmed && (
        <RequestPaymentCard reservationId={id} amountDue={r.downPaymentAmount} />
      )}
      {/* G20: the balance opens once the documents are validated (step 3). */}
      {!isCancelled &&
        r.downPaymentConfirmed &&
        r.documentsReceivedAt &&
        !r.remainingPaymentConfirmedAt &&
        r.money.balanceOwed > 0 && (
          <RequestPaymentCard
            reservationId={id}
            purpose="SOLDE"
            amountDue={r.money.balanceOwed}
            expected={r.money.balanceExpected}
          />
        )}

      <div className="grid gap-6 lg:grid-cols-[1fr_500px]">
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
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">{tMy('kambriqDocsTitle')}</h2>
            {kambriqDocs.length === 0 ? (
              <p className="text-sm text-slate-500">{tMy('kambriqDocsEmpty')}</p>
            ) : (
              <div className="space-y-2">
                {kambriqDocs.map((d) => (
                  <div key={d.id} className="rounded-sm border border-slate-100 bg-white">
                    <div className="px-4 py-5 sm:p-6">
                      <div className="sm:flex sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">{d.name}</h3>
                          <div className="mt-2 max-w-xl text-sm text-gray-500">
                            <p>{tMy('docDescriptionFallback')}</p>
                          </div>
                        </div>
                        <div className="mt-5 sm:mt-0 sm:ml-6 sm:flex sm:shrink-0 sm:items-center">
                          <Button asChild>
                            <a href={d.downloadUrl} target="_blank" rel="noopener noreferrer">
                              {tMy('download')}
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">{tMy('clientDocsTitle')}</h2>
            <p className="mb-3 text-xs text-slate-500">{tMy('clientDocsHint')}</p>
            <div className="space-y-2">
              {r.requiredDocuments.map((slot) => {
                const inputId = `client-doc-${slot.type}`;
                const isUploading =
                  uploadMutation.isPending && uploadMutation.variables?.type === slot.type;
                return (
                  <div key={slot.type} className="rounded-sm border border-slate-100 bg-white">
                    <div className="px-2 py-2.5 sm:p-3">
                      <div className="sm:flex sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">
                            {tMy(`docType.${slot.type}`)}
                          </h3>
                          <div className="mt-2 max-w-xl text-xs text-gray-500">
                            <p>
                              {slot.uploaded && slot.document
                                ? slot.document.name
                                : tMy(`docDescription.${slot.type}`)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-5 sm:mt-0 sm:ml-6 sm:flex sm:shrink-0 sm:items-center sm:gap-2">
                          {slot.uploaded && slot.document ? (
                            <>
                              <Button disabled variant="outline">
                                {tMy('uploaded')}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={
                                  deleteMutation.isPending &&
                                  deleteMutation.variables === slot.document.id
                                }
                                onClick={() =>
                                  slot.document && deleteMutation.mutate(slot.document.id)
                                }
                              >
                                {deleteMutation.isPending &&
                                deleteMutation.variables === slot.document.id
                                  ? tMy('removing')
                                  : tMy('remove')}
                              </Button>
                            </>
                          ) : (
                            <>
                              <input
                                id={inputId}
                                type="file"
                                className="hidden"
                                accept="image/*,application/pdf"
                                disabled={isUploading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = '';
                                  if (!file) return;
                                  if (file.size > MAX_UPLOAD_BYTES) {
                                    setSizeError(true);
                                    return;
                                  }
                                  setSizeError(false);
                                  uploadMutation.mutate({ type: slot.type, file });
                                }}
                              />
                              <Button asChild disabled={isUploading}>
                                <Label htmlFor={inputId} className="cursor-pointer">
                                  {isUploading && <Spinner className="mr-2 size-3" />}
                                  {isUploading ? tMy('uploading') : tMy('upload')}
                                </Label>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {sizeError && <p className="mt-3 text-sm text-destructive">{tMy('fileTooLarge')}</p>}
            {uploadMutation.isError && (
              <p className="mt-3 text-sm text-destructive">{tMy('uploadFailed')}</p>
            )}
            {deleteMutation.isError && (
              <p className="mt-3 text-sm text-destructive">{tMy('removeFailed')}</p>
            )}
          </div>

          <div className="divide-y divide-gray-200 rounded-md border border-slate-200 bg-white">
            <div className="flex w-full items-center justify-between space-x-6 p-6">
              <div className="flex-1 truncate">
                <p className="text-xs text-slate-400">{tMy('agentLabel')}</p>
                <h3 className="truncate text-sm font-medium text-gray-900">
                  {r.agent.firstName} {r.agent.lastName}
                </h3>
                <p className="mt-1 truncate text-sm text-gray-500">{r.agent.email}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
                {initials}
              </div>
            </div>
            <div>
              <div className="-mt-px flex divide-x divide-gray-200">
                <div className="flex w-0 flex-1">
                  <a
                    href={`mailto:${r.agent.email}`}
                    className="relative -mr-px inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-bl-lg border border-transparent py-4 text-sm font-semibold text-gray-900"
                  >
                    <MailIcon aria-hidden="true" className="size-5 text-gray-400" />
                    {tMy('emailButton')}
                  </a>
                </div>
                {whatsappUrl && (
                  <div className="-ml-px flex w-0 flex-1">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-br-lg border border-transparent py-4 text-sm font-semibold text-gray-900"
                    >
                      <PhoneIcon aria-hidden="true" className="size-5 text-gray-400" />
                      {tMy('whatsappButton')}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
