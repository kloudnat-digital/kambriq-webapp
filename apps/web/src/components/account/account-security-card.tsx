'use client';

import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useToastStore } from '@/store/toast.store';
import { changePassword } from '@/lib/actions/account';
import {
  CHANGE_PASSWORD_DEFAULTS,
  ChangePasswordFormResolver,
  type ChangePasswordFormSchema,
} from '@/validations/schema/account';

export const AccountSecurityCard = () => {
  const t = useTranslations('app.account.security');
  const { createToast } = useToastStore();

  const { control, handleSubmit, formState, reset } = useForm<ChangePasswordFormSchema>({
    resolver: zodResolver(ChangePasswordFormResolver),
    defaultValues: CHANGE_PASSWORD_DEFAULTS,
  });

  const { isSubmitting } = formState;

  const errText = (key: string | undefined) => (key ? t(key as never) : undefined);

  const onSubmit = async (data: ChangePasswordFormSchema) => {
    const result = await changePassword({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
    if (!result.success) {
      createToast({ status: 'error', title: result.error || t('error') });
      return;
    }
    createToast({ status: 'success', title: t('success') });
    reset(CHANGE_PASSWORD_DEFAULTS);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            name="currentPassword"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="currentPassword">{t('currentPassword')}</FieldLabel>
                <Input
                  {...field}
                  id="currentPassword"
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
          <Controller
            name="newPassword"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="newPassword">{t('newPassword')}</FieldLabel>
                <Input
                  {...field}
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.error && (
                  <FieldError errors={[{ message: errText(fieldState.error.message) }]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="confirmPassword"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="confirmPassword">{t('confirmPassword')}</FieldLabel>
                <Input
                  {...field}
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.error && (
                  <FieldError errors={[{ message: errText(fieldState.error.message) }]} />
                )}
              </Field>
            )}
          />

          <div className="text-right">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner className="size-4" />}
              {isSubmitting ? t('submitting') : t('submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
