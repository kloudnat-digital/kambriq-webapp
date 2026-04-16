'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { FC } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { ForgotPasswordSchema } from '@/validations/schema/auth';
import { ForgotPasswordResolver } from '@/validations/schema/auth';
import { forgotPasswordAction } from '@/lib/actions/auth';
import { useToastStore } from '@/store/toast.store';

const ForgotPassword: FC = () => {
  const t = useTranslations('auth');
  const { createToast } = useToastStore();

  const methods = useForm<ForgotPasswordSchema>({
    resolver: zodResolver(ForgotPasswordResolver),
    defaultValues: {
      email: '',
    },
  });

  const {
    formState: { isSubmitting },
  } = methods;

  const handleSubmit = async (data: ForgotPasswordSchema) => {
    const result = await forgotPasswordAction(data.email);
    if (!result.success) {
      createToast({ status: 'error', title: result.error });
    } else {
      createToast({ status: 'success', title: t('forgotPassword.successMessage') });
      methods.reset();
    }
  };

  return (
    <form className="space-y-6" onSubmit={methods.handleSubmit(handleSubmit)}>
      <FieldGroup>
        <Controller
          name="email"
          control={methods.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email">{t('forgotPassword.email')}</FieldLabel>
              <Input
                {...field}
                id="email"
                type="email"
                disabled={isSubmitting}
                aria-invalid={fieldState.invalid}
                placeholder="you@example.com"
                autoComplete="email"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {t('forgotPassword.submit')}
        </Button>
      </FieldGroup>

      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t('forgotPassword.backToLogin')}
        </Link>
      </div>
    </form>
  );
};

export default ForgotPassword;
