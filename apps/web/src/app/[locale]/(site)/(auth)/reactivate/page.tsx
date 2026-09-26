'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, type FC } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { ReactivateSchema } from '@/validations/schema/auth';
import { ReactivateResolver } from '@/validations/schema/auth';
import { reactivateAccountAction } from '@/lib/actions/auth';
import { useToastStore } from '@/store/toast.store';

/**
 * `/reactivate` was listed in PUBLIC_PATHS and had no page behind it.
 *
 * `lib/actions/auth.ts` redirects here with `?userId=…&days=…` when the API
 * signals REACTIVATION_REQUIRED, so a user in the soft-delete grace period -
 * somebody trying to undo a deletion, on a clock - was sent to a 404. The route
 * entry was correct; the page was simply missing.
 *
 * The `days` query parameter is display only. It is attacker-controllable, so it
 * is parsed defensively and only ever renders a count: the grace period itself
 * is enforced by the API, which re-checks it on POST /auth/reactivate. A wrong
 * number here misleads; it cannot extend anybody's window.
 *
 * `userId` arrives in the query string too, and is deliberately unused. The API
 * reactivates on email + password, so the user proves who they are rather than
 * the URL asserting it.
 */
const parseDays = (raw: string | null): number | null => {
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 365) return null;
  return n;
};

const ReactivateForm: FC = () => {
  const t = useTranslations('auth');
  const { createToast } = useToastStore();
  const days = parseDays(useSearchParams().get('days'));

  const methods = useForm<ReactivateSchema>({
    resolver: zodResolver(ReactivateResolver),
    defaultValues: { email: '', password: '' },
  });

  const {
    formState: { isSubmitting },
  } = methods;

  const handleSubmit = async (data: ReactivateSchema) => {
    const result = await reactivateAccountAction(data);
    // On success the action signs the user in and redirects, so nothing after
    // this runs. Only the failure path needs handling here.
    if (!result.success) {
      createToast({ status: 'error', title: result.error });
    }
  };

  const graceMessage =
    days === null
      ? t('reactivate.graceUnknown')
      : days === 1
        ? t('reactivate.graceOne')
        : t('reactivate.graceOther', { days });

  return (
    <form method="post" className="space-y-6" onSubmit={methods.handleSubmit(handleSubmit)}>
      <div
        role="status"
        className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        <p className="font-medium">{graceMessage}</p>
        <p className="mt-1 text-amber-800">{t('reactivate.explanation')}</p>
      </div>

      <FieldGroup>
        <Controller
          name="email"
          control={methods.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email">{t('reactivate.email')}</FieldLabel>
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
              <FieldLabel htmlFor="password">{t('reactivate.password')}</FieldLabel>
              <Input
                {...field}
                id="password"
                type="password"
                disabled={isSubmitting}
                aria-invalid={fieldState.invalid}
                autoComplete="current-password"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {t('reactivate.submit')}
        </Button>
      </FieldGroup>

      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t('reactivate.backToLogin')}
        </Link>
      </div>
    </form>
  );
};

// useSearchParams needs a Suspense boundary, otherwise the whole route opts out
// of static rendering at build time.
const Reactivate: FC = () => (
  <Suspense fallback={null}>
    <ReactivateForm />
  </Suspense>
);

export default Reactivate;
