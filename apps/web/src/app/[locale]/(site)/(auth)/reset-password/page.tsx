'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState, type FC } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import type { ResetPasswordSchema } from '@/validations/schema/auth';
import { ResetPasswordResolver } from '@/validations/schema/auth';
import { useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { resetPasswordAction } from '@/lib/actions/auth';
import { useToastStore } from '@/store/toast.store';
import { AUTH_ROUTES } from '@/routes';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { EyeIcon, EyeOffIcon } from 'lucide-react';

const ResetPassword: FC = () => {
  const [showPassword, setShowPassword] = useState(false);

  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { createToast } = useToastStore();

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const methods = useForm<ResetPasswordSchema>({
    resolver: zodResolver(ResetPasswordResolver),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const {
    formState: { isSubmitting },
  } = methods;

  const handleSubmit = async (data: ResetPasswordSchema) => {
    if (!token) {
      createToast({ status: 'error', title: t('resetPassword.missingToken') });
      return;
    }
    const result = await resetPasswordAction(token, data.password);
    if (!result.success) {
      createToast({ status: 'error', title: result.error });
    } else {
      createToast({ status: 'success', title: t('resetPassword.successMessage') });
      setTimeout(() => router.push(AUTH_ROUTES.LOGIN), 1500);
    }
  };

  return (
    <form className="space-y-6" onSubmit={methods.handleSubmit(handleSubmit)}>
      <FieldGroup>
        <Controller
          name="password"
          control={methods.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="password">{t('resetPassword.password')}</FieldLabel>
              <InputGroup className="h-9">
                <InputGroupInput
                  {...field}
                  id="password"
                  disabled={isSubmitting}
                  aria-invalid={fieldState.invalid}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  type={showPassword ? 'text' : 'password'}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                />
                <InputGroupAddon align="inline-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isSubmitting}
                    onClick={togglePasswordVisibility}
                    type="button"
                    className="hover:bg-transparent"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </Button>
                </InputGroupAddon>
              </InputGroup>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="confirmPassword"
          control={methods.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="confirmPassword">
                {t('resetPassword.confirmPassword')}
              </FieldLabel>
              <InputGroup className="h-9">
                <InputGroupInput
                  {...field}
                  id="confirmPassword"
                  disabled={isSubmitting}
                  aria-invalid={fieldState.invalid}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  type={showPassword ? 'text' : 'password'}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                />
                <InputGroupAddon align="inline-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isSubmitting}
                    onClick={togglePasswordVisibility}
                    type="button"
                    className="hover:bg-transparent"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </Button>
                </InputGroupAddon>
              </InputGroup>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {t('resetPassword.submit')}
        </Button>
      </FieldGroup>
    </form>
  );
};

export default ResetPassword;
