'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState, type FC } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { RegisterSchema } from '@/validations/schema/auth';
import { RegisterResolver } from '@/validations/schema/auth';
import { registerAction } from '@/lib/actions/auth';
import { useLocale } from 'next-intl';
import { useToastStore } from '@/store/toast.store';
import { useRouter } from '@/i18n/navigation';
import { AUTH_ROUTES } from '@/routes';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { EyeIcon, EyeOffIcon } from 'lucide-react';

const Register: FC = () => {
  const [showPassword, setShowPassword] = useState(false);

  const t = useTranslations('auth');
  const locale = useLocale();
  const { createToast } = useToastStore();
  const router = useRouter();

  const methods = useForm<RegisterSchema>({
    resolver: zodResolver(RegisterResolver),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
    },
  });

  const { formState } = methods;
  const { isSubmitting } = formState;

  const handleSubmit = async (data: RegisterSchema) => {
    const result = await registerAction({ ...data, language: locale });
    if (!result.success) {
      createToast({ status: 'error', title: result.error });
      return;
    }
    createToast({
      status: 'success',
      title: t('register.successTitle'),
      description: t('register.successDescription'),
    });
    router.push(AUTH_ROUTES.LOGIN);
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <form method="post" className="space-y-6" onSubmit={methods.handleSubmit(handleSubmit)}>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <Controller
            name="firstName"
            control={methods.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="firstName">{t('register.firstName')}</FieldLabel>
                <Input
                  {...field}
                  id="firstName"
                  disabled={isSubmitting}
                  aria-invalid={fieldState.invalid}
                  placeholder={t('register.firstNamePlaceholder')}
                  autoComplete="given-name"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="lastName"
            control={methods.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="lastName">{t('register.lastName')}</FieldLabel>
                <Input
                  {...field}
                  id="lastName"
                  disabled={isSubmitting}
                  aria-invalid={fieldState.invalid}
                  placeholder={t('register.lastNamePlaceholder')}
                  autoComplete="family-name"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>

        <Controller
          name="email"
          control={methods.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email">{t('register.email')}</FieldLabel>
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

        <Controller
          name="phone"
          control={methods.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="phone">{t('register.phone')}</FieldLabel>
              <Input
                {...field}
                id="phone"
                type="tel"
                disabled={isSubmitting}
                aria-invalid={fieldState.invalid}
                placeholder={t('register.phonePlaceholder')}
                autoComplete="tel"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="password"
          control={methods.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="password">{t('register.password')}</FieldLabel>
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

        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {t('register.submit')}
        </Button>
      </FieldGroup>
    </form>
  );
};

export default Register;
