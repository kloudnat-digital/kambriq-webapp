'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  CancelReservationFormResolver,
  CANCEL_RESERVATION_DEFAULTS,
  type CancelReservationFormSchema,
} from '@/validations/schema/lands';

interface CancelReservationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
}

export const CancelReservationModal = ({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: CancelReservationModalProps) => {
  const t = useTranslations('app.reservations');

  const { control, handleSubmit, reset } = useForm<CancelReservationFormSchema>({
    resolver: zodResolver(CancelReservationFormResolver),
    defaultValues: CANCEL_RESERVATION_DEFAULTS,
  });

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = (data: CancelReservationFormSchema) => {
    onConfirm(data.reason);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('cancelDialogTitle')}</DialogTitle>
          <DialogDescription>{t('cancelDialogDesc')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            name="reason"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="cancel-reason">{t('cancelReasonLabel')}</FieldLabel>
                <Textarea
                  {...field}
                  id="cancel-reason"
                  rows={4}
                  aria-invalid={fieldState.invalid}
                  placeholder={t('cancelReasonPlaceholder')}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t('cancelDismiss')}
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending && <Spinner className="size-4" />}
              {t('cancelConfirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
