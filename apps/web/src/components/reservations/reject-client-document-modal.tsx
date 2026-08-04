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
  RejectClientDocumentFormResolver,
  REJECT_CLIENT_DOCUMENT_DEFAULTS,
  type RejectClientDocumentFormSchema,
} from '@/validations/schema/lands';

interface RejectClientDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
}

export const RejectClientDocumentModal = ({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: RejectClientDocumentModalProps) => {
  const t = useTranslations('app.reservations');

  const { control, handleSubmit, reset } = useForm<RejectClientDocumentFormSchema>({
    resolver: zodResolver(RejectClientDocumentFormResolver),
    defaultValues: REJECT_CLIENT_DOCUMENT_DEFAULTS,
  });

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = (data: RejectClientDocumentFormSchema) => {
    onConfirm(data.reason);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('rejectModalTitle')}</DialogTitle>
          <DialogDescription>{t('rejectModalDesc')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            name="reason"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="reject-reason">{t('rejectReasonLabel')}</FieldLabel>
                <Textarea
                  {...field}
                  id="reject-reason"
                  rows={4}
                  aria-invalid={fieldState.invalid}
                  placeholder={t('rejectReasonPlaceholder')}
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
              {t('rejectDismiss')}
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending && <Spinner className="size-4" />}
              {t('rejectConfirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
