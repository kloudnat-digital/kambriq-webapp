'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, type FC } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { LoginSchema } from '@/validations/schema/auth';
import { LoginResolver } from '@/validations/schema/auth';
import { Label } from '@/components/ui/label';
import { logInAction } from '@/lib/actions/auth';
import { useToastStore } from '@/store/toast.store';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { EyeIcon, EyeOffIcon } from 'lucide-react';

const Login: FC = () => {
  const [showPassword, setShowPassword] = useState(false);

  const t = useTranslations('auth');
  const { createToast } = useToastStore();

  const methods = useForm<LoginSchema>({
    resolver: zodResolver(LoginResolver),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const { formState, reset } = methods;
  const { isSubmitting } = formState;

  const handleSubmit = async (data: LoginSchema) => {
    const result = await logInAction(data);
    if (result && !result.success) {
      createToast({ status: 'error', title: result.error });
    }
    reset();
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <form className="space-y-6" onSubmit={methods.handleSubmit(handleSubmit)}>
      <FieldGroup>
        <Controller
          name="email"
          control={methods.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email">{t('login.email')}</FieldLabel>
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
          name="password"
          control={methods.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="password">{t('login.password')}</FieldLabel>
              <InputGroup className="h-9">
                <InputGroupInput
                  {...field}
                  id="password"
                  disabled={isSubmitting}
                  aria-invalid={fieldState.invalid}
                  placeholder="••••••••"
                  autoComplete="current-password"
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

        <div className="flex items-center justify-between">
          <Controller
            name="rememberMe"
            control={methods.control}
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <Checkbox
                  id="rememberMe"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
                <Label htmlFor="rememberMe">{t('login.rememberMe')}</Label>
              </div>
            )}
          />
          <Link
            href="/forgot-password"
            className="text-sm/6 font-semibold text-primary hover:text-primary/80"
          >
            {t('login.forgotPassword')}
          </Link>
        </div>

        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting ? t('login.loggingIn') : t('login.logIn')}
        </Button>
      </FieldGroup>
    </form>
  );
};

export default Login;
