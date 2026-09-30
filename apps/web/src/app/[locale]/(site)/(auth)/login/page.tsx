'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState, type FC } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { LoginSchema } from '@/validations/schema/auth';
import { LoginResolver } from '@/validations/schema/auth';
import { Label } from '@/components/ui/label';
import { logInAction, resendVerificationAction } from '@/lib/actions/auth';
import { useToastStore } from '@/store/toast.store';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { EyeIcon, EyeOffIcon } from 'lucide-react';

const Login: FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  // C37: set only when the API accepted the password of an unverified account.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const t = useTranslations('auth');
  // J12: the schema refuses with a key; the reader sees it in their language.
  const inReaderLanguage = (error?: { message?: string }) =>
    error && { message: error.message ? t(`validation.${error.message}` as never) : undefined };
  const { createToast } = useToastStore();
  // I45: the page the proxy sent the person from; the action checks it.
  const callbackUrl = useSearchParams()?.get('callbackUrl') ?? null;

  const methods = useForm<LoginSchema>({
    resolver: zodResolver(LoginResolver),
    // A33: no default for the email and the password. A default is written into
    // the field when it registers, which would erase what the visitor typed
    // before the page hydrated; without one, the field's own value is read.
    defaultValues: {
      rememberMe: false,
    },
  });

  const { formState, reset, register } = methods;
  const { isSubmitting, errors } = formState;

  const handleSubmit = async (data: LoginSchema) => {
    const result = await logInAction({ ...data, callbackUrl });
    if (result && !result.success) {
      if (result.status === 403) {
        setUnverifiedEmail(data.email);
        setResend('idle');
      } else {
        createToast({ status: 'error', title: result.error });
      }
    }
    reset();
  };

  // The confirmation says the same thing whatever the API found, as the API does.
  const handleResend = async () => {
    if (!unverifiedEmail) return;
    setResend('sending');
    const result = await resendVerificationAction(unverifiedEmail);
    setResend(result && !result.success ? 'failed' : 'sent');
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <form method="post" className="space-y-6" onSubmit={methods.handleSubmit(handleSubmit)}>
      <FieldGroup>
        {unverifiedEmail && (
          <div role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="font-medium">{t('login.unverifiedTitle')}</p>
            {resend === 'sent' ? (
              <p className="mt-2">{t('login.resendSent')}</p>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="mt-2"
                disabled={resend === 'sending'}
                onClick={handleResend}
              >
                {t('login.resendVerification')}
              </Button>
            )}
            {resend === 'failed' && <p className="mt-2">{t('login.resendFailed')}</p>}
          </div>
        )}
        {/*
          A33: the email and the password are uncontrolled (`register`), so what
          the visitor typed before hydration survives it. As controlled inputs,
          hydration wrote their empty state over the typed text, validation
          refused, and the button appeared to do nothing.
        */}
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">{t('login.email')}</FieldLabel>
          <Input
            {...register('email')}
            id="email"
            type="email"
            disabled={isSubmitting}
            aria-invalid={!!errors.email}
            placeholder="you@example.com"
            autoComplete="email"
          />
          {errors.email && <FieldError errors={[inReaderLanguage(errors.email)]} />}
        </Field>

        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">{t('login.password')}</FieldLabel>
          <InputGroup className="h-9">
            <InputGroupInput
              {...register('password')}
              id="password"
              disabled={isSubmitting}
              aria-invalid={!!errors.password}
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
                {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </Button>
            </InputGroupAddon>
          </InputGroup>
          {errors.password && <FieldError errors={[inReaderLanguage(errors.password)]} />}
        </Field>

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
