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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useToastStore } from '@/store/toast.store';
import { requestEmailChange } from '@/lib/actions/account';
import {
  REQUEST_EMAIL_CHANGE_DEFAULTS,
  RequestEmailChangeFormResolver,
  type RequestEmailChangeFormSchema,
} from '@/validations/schema/account';

interface ChangeEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChangeEmailModal = ({ open, onOpenChange }: ChangeEmailModalProps) => {
  const t = useTranslations('app.account.emailChange');
  const { createToast } = useToastStore();

  const { control, handleSubmit, reset, formState } = useForm<RequestEmailChangeFormSchema>({
    resolver: zodResolver(RequestEmailChangeFormResolver),
    defaultValues: REQUEST_EMAIL_CHANGE_DEFAULTS,
  });

  const { isSubmitting } = formState;

  useEffect(() => {
    if (!open) reset(REQUEST_EMAIL_CHANGE_DEFAULTS);
  }, [open, reset]);

  const errText = (key: string | undefined) => (key ? t(key as never) : undefined);

  const onSubmit = async (data: RequestEmailChangeFormSchema) => {
    const result = await requestEmailChange(data);
    if (!result.success) {
      createToast({ status: 'error', title: result.error || t('error') });
      return;
    }
    createToast({ status: 'success', title: t('success') });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('subtitle')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            name="newEmail"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="ce-new-email">{t('newEmail')}</FieldLabel>
                <Input
                  {...field}
                  id="ce-new-email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.error && (
                  <FieldError errors={[{ message: errText(fieldState.error.message) }]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="currentPassword"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="ce-current-password">{t('currentPassword')}</FieldLabel>
                <Input
                  {...field}
                  id="ce-current-password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.error && (
                  <FieldError errors={[{ message: errText(fieldState.error.message) }]} />
                )}
              </Field>
            )}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner className="size-4" />}
              {isSubmitting ? t('submitting') : t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
