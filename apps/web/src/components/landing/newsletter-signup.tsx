'use client';

import { useId, useState } from 'react';
import type { ComponentPropsWithoutRef, FC } from 'react';
import { Link } from '@/i18n/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { subscribeNewsletterAction } from '@/lib/actions/newsletter';
import type { SubscribeNewsletterSchema } from '@/validations/schema/subscribe';
import { SubscribeNewsletterResolver } from '@/validations/schema/subscribe';
import { useToastStore } from '@/store/toast.store';

/** Where the consent text points. The API records the same path with the consent. */
const PRIVACY_POLICY_PATH = '/legal/privacy';
const RGPD_PATH = '/legal/rgpd';

type NewsletterSignupProps = ComponentPropsWithoutRef<'div'>;

/**
 * P2 - the newsletter form, held to the contact form's discipline (L1).
 *
 * It had none of it: no consent, a resolver that hard-coded one English
 * sentence on a French site, an action that turned every failure into another
 * one, and an address field named by nothing but its placeholder - which the
 * accessibility tree does not count, so its computed name was `""`.
 *
 * Now, as on the contact form:
 * - the resolver carries the rule and the message is a catalogue key;
 * - each message is visible under its field, tied by `aria-describedby`, and
 *   the field is marked `aria-invalid`;
 * - consent is an explicit box with its links, and the server stamps the time;
 * - a refusal is said in a `role="alert"` region and nothing typed is lost.
 *
 * The address label is `sr-only`: the footer's heading and sentence already say
 * what the field is for to anybody who can see them.
 */
const NewsletterSignup: FC<NewsletterSignupProps> = ({ className }) => {
  const t = useTranslations('footer.newsletter');
  const locale = useLocale() === 'en' ? 'en' : 'fr';
  const { createToast } = useToastStore();

  const ids = useId();
  const emailId = `${ids}-email`;
  const emailErrorId = `${ids}-email-error`;
  const consentId = `${ids}-consent`;
  const consentErrorId = `${ids}-consent-error`;

  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubscribeNewsletterSchema>({
    resolver: zodResolver(SubscribeNewsletterResolver),
    defaultValues: { email: '' },
  });

  /** Resolver messages are keys; a key with no catalogue entry throws in tests. */
  const messageFor = (key?: string) => (key ? t(`validation.${key}`) : undefined);

  const onSubmit = async (values: SubscribeNewsletterSchema) => {
    setSubmitError(null);
    const result = await subscribeNewsletterAction({
      email: values.email,
      locale,
      consent: true,
    });

    if (!result.success) {
      // Nothing is reset: the address stays in the field.
      if (result.status === 409) setSubmitError(t('errors.alreadySubscribed'));
      else if (result.retryable || !result.error) setSubmitError(t('errors.submitFailed'));
      else setSubmitError(t('errors.submitRefused', { reason: result.error }));
      return;
    }

    createToast({ status: 'success', title: t('success.title') });
    reset();
  };

  return (
    <div
      className={cn(
        'border-t border-primary-foreground/20 pt-8 sm:mt-20 lg:mt-24 lg:flex lg:items-center lg:justify-between',
        className,
      )}
    >
      <div>
        <h3 className="text-sm/6 font-semibold">{t('title')}</h3>
        <p className="mt-2 text-sm/6">{t('description')}</p>
      </div>
      <form
        className="mt-6 space-y-3 sm:max-w-md lg:mt-0"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <div className="w-full sm:flex sm:items-start">
          <div className="w-full space-y-1.5">
            <Label htmlFor={emailId} className="sr-only">
              {t('emailLabel')}
            </Label>
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id={emailId}
                  type="email"
                  autoComplete="email"
                  placeholder={t('placeholder')}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? emailErrorId : undefined}
                  className="h-10 border-primary-foreground/20 bg-background/10 text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:border-primary-foreground/40"
                />
              )}
            />
            {errors.email && (
              <p id={emailErrorId} className="text-sm text-destructive">
                {messageFor(errors.email.message)}
              </p>
            )}
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-4 sm:shrink-0">
            <Button
              type="submit"
              variant="secondary"
              className="h-10 whitespace-nowrap"
              disabled={isSubmitting}
            >
              {t('submit')}
            </Button>
          </div>
        </div>

        {/* Consent. Required, and its timestamp is stored with the subscription -
            the server's clock, because a consent time supplied by a browser is
            a claim rather than a record. */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-3">
            <Controller
              name="consent"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id={consentId}
                  checked={field.value === true}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  aria-invalid={!!errors.consent}
                  aria-describedby={errors.consent ? consentErrorId : undefined}
                  className="mt-0.5"
                />
              )}
            />
            <Label htmlFor={consentId} className="text-xs leading-relaxed font-normal">
              {/* P25: one inline element, or the flex label lays out each fragment as a column. */}
              <span>
                {t('consent.text')}{' '}
                <Link href={PRIVACY_POLICY_PATH} className="underline underline-offset-2">
                  {t('consent.privacyLink')}
                </Link>{' '}
                {t('consent.and')}{' '}
                <Link href={RGPD_PATH} className="underline underline-offset-2">
                  {t('consent.rgpdLink')}
                </Link>
              </span>
            </Label>
          </div>
          {errors.consent && (
            <p id={consentErrorId} className="text-sm text-destructive">
              {messageFor(errors.consent.message)}
            </p>
          )}
        </div>

        {submitError && (
          <div role="alert" aria-live="assertive" className="text-sm text-destructive">
            {submitError}
          </div>
        )}
      </form>
    </div>
  );
};

export default NewsletterSignup;
