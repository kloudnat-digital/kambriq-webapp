'use client';

import { useMemo, useState } from 'react';
import { depositFor } from '@kambriq/common/payments/deposit';
import { fitsIn, portionPrice } from '@kambriq/common/payments/portion';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { useToastStore } from '@/store/toast.store';
import type { ReserveLandFormSchema } from '@/validations/schema/lands';
import { ReserveLandFormResolver, RESERVE_LAND_DEFAULTS } from '@/validations/schema/lands';
import { createReservationAction, cancelReservationAction } from '@/lib/actions/lands';
import { CancelReservationModal } from '@/components/reservations/cancel-reservation-modal';
import { formatXAF } from '@/lib/money';
import type { LandDetail } from '@/types/lands';
import { cn } from '@/lib/utils';

interface Props {
  landId: string;
  /** C49: the parcel's whole price and surface, and the surface still for sale. */
  sale: { totalPrice: number; sizeM2: number; remainingM2: number };
  className?: string;
  reservation?: LandDetail['reservations'][0];
  currentUserId: string;
  isAdmin: boolean;
  canManageReservations?: boolean;
}

export const ReserveForm = ({
  landId,
  sale,
  reservation,
  className,
  currentUserId,
  isAdmin,
  canManageReservations,
}: Props) => {
  const router = useRouter();
  const t = useTranslations('app.reserveForm');
  const { createToast } = useToastStore();

  const defaultValues: ReserveLandFormSchema = reservation
    ? {
        name: reservation.clientName,
        email: reservation.clientEmail,
        emailConfirm: reservation.clientEmail,
        phone: reservation.clientPhone,
      }
    : RESERVE_LAND_DEFAULTS;

  const methods = useForm<ReserveLandFormSchema>({
    resolver: zodResolver(ReserveLandFormResolver),
    defaultValues,
  });

  const { formState } = methods;
  const { isSubmitting } = formState;

  const [isCancelOpen, setIsCancelOpen] = useState(false);
  // C29: a valid form is read back to the client before anything is sent.
  const [toReadBack, setToReadBack] = useState<ReserveLandFormSchema | null>(null);
  const [isSending, setIsSending] = useState(false);

  // C49: the surface bought, the whole of what is left unless the agent says
  // less. Priced as the API prices it - pro rata of the parcel's total - so
  // what the agent reads to the client is what the client will be asked.
  const [surface, setSurface] = useState(String(sale.remainingM2));
  const surfaceM2 = Number(surface.replace(',', '.'));
  const surfaceOk = Number.isFinite(surfaceM2) && fitsIn(surfaceM2, sale.remainingM2);
  const amount = useMemo(
    () => (surfaceOk ? Number(portionPrice(BigInt(sale.totalPrice), surfaceM2, sale.sizeM2)) : 0),
    [surfaceOk, surfaceM2, sale.totalPrice, sale.sizeM2],
  );
  const deposit = depositFor(reservation ? (reservation.saleAmount ?? 0) : amount);

  const isReserved = Boolean(reservation);
  const isDisabled = isReserved || isSubmitting;
  const canCancel = isAdmin || reservation?.agentUserId === currentUserId;

  const handleReserve = (data: ReserveLandFormSchema) => {
    if (!surfaceOk) return;
    setToReadBack(data);
  };

  const sendAfterReadBack = async () => {
    if (!toReadBack) return;
    setIsSending(true);
    const result = await createReservationAction({
      landId,
      clientName: toReadBack.name,
      clientEmail: toReadBack.email,
      clientPhone: toReadBack.phone,
      purchasedM2: surfaceM2,
    });
    setIsSending(false);

    if (!result.success) {
      createToast({ status: 'error', title: result.error ?? t('apiError') });
      return;
    }

    createToast({ status: 'success', title: t('submit') });
    router.push('/reservations');
  };

  const handleCancel = async (reason: string) => {
    if (!reservation) return;
    const result = await cancelReservationAction(reservation.id, reason);
    if (!result.success) {
      createToast({ status: 'error', title: result.error ?? t('apiError') });
      return;
    }
    setIsCancelOpen(false);
    createToast({ status: 'success', title: t('cancelSuccess') });
    router.refresh();
  };

  return (
    <div className={cn('space-y-5', className)}>
      <div
        className={cn(
          'w-full rounded-md bg-white p-4 ring-2',
          isReserved ? 'ring-red-500' : 'ring-primary-500',
        )}
      >
        <h2
          className={cn(
            'mb-4 text-base font-semibold',
            isReserved ? 'text-red-500' : 'text-primary-500',
          )}
        >
          {isReserved ? t('reservedTitle') : t('pageTitle')}
        </h2>
        <form onSubmit={methods.handleSubmit(handleReserve)}>
          <FieldGroup>
            <div className="space-y-4">
              <Controller
                name="name"
                control={methods.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="res-name">{t('fullName')}</FieldLabel>
                    <Input
                      {...field}
                      id="res-name"
                      type="text"
                      disabled={isDisabled}
                      aria-invalid={fieldState.invalid}
                      placeholder={t('fullNamePlaceholder')}
                      autoComplete="name"
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <Controller
                name="email"
                control={methods.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="res-email">{t('email')}</FieldLabel>
                    <Input
                      {...field}
                      id="res-email"
                      type="email"
                      disabled={isDisabled}
                      aria-invalid={fieldState.invalid}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                    <FieldDescription>{t('emailHint')}</FieldDescription>
                  </Field>
                )}
              />

              {!isReserved && (
                <Controller
                  name="emailConfirm"
                  control={methods.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="res-email-confirm">{t('emailConfirm')}</FieldLabel>
                      <Input
                        {...field}
                        id="res-email-confirm"
                        type="email"
                        disabled={isDisabled || Boolean(toReadBack)}
                        aria-invalid={fieldState.invalid}
                        autoComplete="off"
                        onPaste={(e) => e.preventDefault()}
                      />
                      {fieldState.error && (
                        <FieldError errors={[{ message: t('emailConfirmMismatch') }]} />
                      )}
                      <FieldDescription>{t('emailConfirmHint')}</FieldDescription>
                    </Field>
                  )}
                />
              )}

              <Controller
                name="phone"
                control={methods.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="res-phone">{t('phone')}</FieldLabel>
                    <Input
                      {...field}
                      id="res-phone"
                      type="tel"
                      disabled={isDisabled}
                      aria-invalid={fieldState.invalid}
                      placeholder={t('phonePlaceholder')}
                      autoComplete="tel"
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              {isReserved && reservation ? (
                <Field>
                  <FieldLabel>{t('surface')}</FieldLabel>
                  <Input disabled type="text" value={`${reservation.purchasedM2} m²`} />
                </Field>
              ) : (
                <Field data-invalid={!surfaceOk}>
                  <FieldLabel htmlFor="res-surface">{t('surface')}</FieldLabel>
                  <Input
                    id="res-surface"
                    inputMode="decimal"
                    value={surface}
                    disabled={isDisabled || Boolean(toReadBack)}
                    aria-invalid={!surfaceOk}
                    onChange={(e) => setSurface(e.target.value)}
                  />
                  {!surfaceOk && (
                    <FieldError
                      errors={[{ message: t('surfaceInvalid', { remaining: sale.remainingM2 }) }]}
                    />
                  )}
                  <FieldDescription>
                    {t('surfaceHint', { remaining: sale.remainingM2, size: sale.sizeM2 })}
                  </FieldDescription>
                </Field>
              )}

              <Field>
                <FieldLabel>{t('saleAmount')}</FieldLabel>
                <Input
                  disabled
                  type="text"
                  value={formatXAF(reservation ? (reservation.saleAmount ?? 0) : amount)}
                />
              </Field>

              <Field>
                <FieldLabel>{t('summaryDeposit')}</FieldLabel>
                <Input disabled type="text" value={formatXAF(deposit)} />
              </Field>
            </div>
          </FieldGroup>

          {!isReserved && !toReadBack && (
            <Button
              type="submit"
              className="mt-5 h-10 w-full"
              disabled={isSubmitting || !canManageReservations || !surfaceOk}
            >
              {isSubmitting ? '…' : t('submit')}
            </Button>
          )}

          {!isReserved && toReadBack && (
            <div
              data-testid="read-back"
              role="alertdialog"
              aria-labelledby="read-back-title"
              className="mt-5 space-y-3 rounded-md bg-amber-50 p-4 ring-1 ring-amber-300"
            >
              <p id="read-back-title" className="font-semibold text-amber-900">
                {t('readBackTitle')}
              </p>
              <p className="font-mono text-lg break-all text-gray-900">{toReadBack.email}</p>
              <p className="text-sm font-semibold text-amber-900">
                {t('readBackSale', { surface: surfaceM2, amount: formatXAF(amount) })}
              </p>
              <p className="text-sm text-amber-900">{t('readBackBody')}</p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  className="h-10 flex-1"
                  disabled={isSending || !canManageReservations}
                  onClick={sendAfterReadBack}
                >
                  {isSending ? '…' : t('readBackConfirm')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 flex-1"
                  disabled={isSending}
                  onClick={() => setToReadBack(null)}
                >
                  {t('readBackEdit')}
                </Button>
              </div>
            </div>
          )}
        </form>

        {isReserved && canCancel && (
          <Button
            type="button"
            variant="destructive"
            className="mt-5 h-10 w-full"
            disabled={isSubmitting || !canManageReservations}
            onClick={() => setIsCancelOpen(true)}
          >
            {t('cancelButton')}
          </Button>
        )}
      </div>

      <CancelReservationModal
        open={isCancelOpen}
        onOpenChange={setIsCancelOpen}
        onConfirm={handleCancel}
        isPending={isSubmitting}
      />
    </div>
  );
};
