'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  deposit: number;
  className?: string;
  reservation?: LandDetail['reservations'][0];
  currentUserId: string;
  isAdmin: boolean;
  canManageReservations?: boolean;
}

export const ReserveForm = ({
  landId,
  deposit,
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

  const isReserved = Boolean(reservation);
  const isDisabled = isReserved || isSubmitting;
  const canCancel = isAdmin || reservation?.agentUserId === currentUserId;

  const handleReserve = async (data: ReserveLandFormSchema) => {
    const result = await createReservationAction({
      landId,
      clientName: data.name,
      clientEmail: data.email,
      clientPhone: data.phone,
    });

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

              <Field>
                <FieldLabel>{t('summaryDeposit')}</FieldLabel>
                <Input disabled type="text" value={formatXAF(deposit)} />
              </Field>
            </div>
          </FieldGroup>

          {!isReserved && (
            <Button
              type="submit"
              className="mt-5 h-10 w-full"
              disabled={isSubmitting || !canManageReservations}
            >
              {isSubmitting ? '…' : t('submit')}
            </Button>
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
