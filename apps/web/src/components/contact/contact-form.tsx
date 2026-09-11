'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToastStore } from '@/store/toast.store';
import { submitContactRequestAction } from '@/lib/actions/contact';
import { ContactFormResolver, type ContactFormSchema } from '@/validations/schema/contact';
import { CONTACT_SUBJECTS } from '@kambriq/common/constants/core';

/** Where the consent text points. The API records the same path on the row. */
const PRIVACY_POLICY_PATH = '/legal/privacy';

/**
 * L1 + L2 - the public contact form.
 *
 * ---------------------------------------------------------------------------
 * What this replaced
 * ---------------------------------------------------------------------------
 * A handler that called `preventDefault`, awaited `setTimeout(800)`, showed a
 * success toast and reset the fields. **No fetch, no server action, nothing
 * persisted.** Every commercial CTA on the site leads here, so every prospect
 * who used it was told their message had been sent and it had not.
 *
 * The toast now fires on one condition only: the server action resolved
 * `success: true`, which it does only once the row exists.
 *
 * ---------------------------------------------------------------------------
 * The subject field, and why it is not `required`
 * ---------------------------------------------------------------------------
 * `<Select required>` makes Radix render a **native `<select required>` at 1x1
 * pixels**, `aria-hidden`, `tabIndex={-1}`, behind the visible trigger. Native
 * constraint validation then blocked submission for an invalid control the
 * browser could neither focus nor annotate: no message, no highlight, and the
 * submit handler never ran at all. The form did nothing and said nothing.
 *
 * So the `required` attribute is gone and the rule is enforced in the resolver.
 * The message renders under the field, `aria-describedby` ties it to the
 * trigger, `aria-invalid` marks it, and focus moves to the trigger on failure -
 * which is a thing a person can act on and a screen reader can announce.
 *
 * The trigger also has an accessible name now. Its label is a `<label>` with no
 * `for`, and a `for` would not have helped: it would point at the trigger's id,
 * and a `<label>` does not name a `<button role="combobox">`. Measured with
 * `computeAccessibleName`, the name was `""` before and is the field's label
 * after, via `aria-labelledby`.
 */
export const ContactForm = () => {
  const t = useTranslations('contact.form');
  const locale = useLocale() === 'en' ? 'en' : 'fr';
  const { createToast } = useToastStore();

  const ids = useId();
  const subjectLabelId = `${ids}-subject-label`;
  const subjectTriggerId = `${ids}-subject-trigger`;
  const subjectErrorId = `${ids}-subject-error`;
  const consentErrorId = `${ids}-consent-error`;

  const subjectTriggerRef = useRef<HTMLButtonElement>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    register,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormSchema>({
    resolver: zodResolver(ContactFormResolver),
    defaultValues: { name: '', email: '', phone: '', message: '' },
  });

  /**
   * Resolver messages are keys, so the same schema can speak both languages.
   * A key with no catalogue entry throws in tests rather than rendering itself.
   */
  const messageFor = (key?: string) => (key ? t(`errors.${key}`) : undefined);

  const onSubmit = async (values: ContactFormSchema) => {
    setSubmitError(null);
    const result = await submitContactRequestAction({
      name: values.name,
      email: values.email,
      phone: values.phone?.trim() ? values.phone.trim() : undefined,
      subject: values.subject,
      message: values.message,
      locale,
      consent: true,
    });

    if (!result.success) {
      /**
       * **Nothing is reset here.** A prospect who wrote three paragraphs and
       * met a 500 must not lose them - react-hook-form keeps the values because
       * this path never calls `reset()`.
       *
       * The message goes into a `role="alert"` region, so it is announced
       * rather than merely displayed, and the wording separates "try again"
       * from "this was refused": inviting a retry on a refusal teaches people
       * to press the button twice.
       */
      setSubmitError(
        result.retryable || !result.error
          ? t('errors.submitFailed')
          : t('errors.submitRefused', { reason: result.error }),
      );
      return;
    }

    // Only here. The row exists.
    setReference(result.reference);
    createToast({ status: 'success', title: t('successMessage') });
    reset();
  };

  /** Called when the resolver refuses. Moves focus to the first bad field. */
  const onInvalid = (fieldErrors: typeof errors) => {
    setSubmitError(null);
    if (fieldErrors.name) return setFocus('name');
    if (fieldErrors.email) return setFocus('email');
    if (fieldErrors.phone) return setFocus('phone');
    // `setFocus` cannot reach the trigger: the registered control is the Radix
    // root, not the button a person clicks. So the ref is focused directly.
    if (fieldErrors.subject) return subjectTriggerRef.current?.focus();
    if (fieldErrors.message) return setFocus('message');
  };

  return (
    <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
      <h2 className="mb-6 text-xl font-semibold text-gray-900">{t('title')}</h2>

      {/*
        Always in the tree, filled only on failure. A region inserted at the
        moment it gets content is announced unreliably; an empty live region
        that later fills is announced.
      */}
      <div role="alert" aria-live="assertive" data-testid="contact-form-error">
        {submitError && (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <strong className="block">{t('errors.summaryTitle')}</strong>
            {submitError}
          </p>
        )}
      </div>

      {reference && (
        <p className="mb-4 rounded-lg border border-primary-600/20 bg-primary-500/5 p-3 text-sm text-gray-800">
          {t('successReference', { reference })}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">{t('name')} *</Label>
            <Input
              id="c-name"
              // The browser can fill these, and a form that refuses help from
              // the password manager is a form more people abandon.
              autoComplete="name"
              placeholder={t('namePlaceholder')}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'c-name-error' : undefined}
              {...register('name')}
            />
            {errors.name && (
              <p id="c-name-error" className="text-sm text-destructive">
                {messageFor(errors.name.message)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-email">{t('email')} *</Label>
            <Input
              id="c-email"
              type="email"
              autoComplete="email"
              placeholder={t('emailPlaceholder')}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'c-email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="c-email-error" className="text-sm text-destructive">
                {messageFor(errors.email.message)}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-phone">
            {t('phone')} <span className="font-normal text-gray-500">({t('optional')})</span>
          </Label>
          <Input
            id="c-phone"
            type="tel"
            autoComplete="tel"
            // International, not `+237 6 XX XX XX XX`. The design's own client
            // base is the diaspora: the person filling this in is more often in
            // Paris, Brussels or Montreal than in Douala, and a placeholder that
            // shows a Cameroonian number reads as "we want a Cameroonian one".
            placeholder={t('phonePlaceholder')}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? 'c-phone-error' : undefined}
            {...register('phone')}
          />
          {errors.phone && (
            <p id="c-phone-error" className="text-sm text-destructive">
              {messageFor(errors.phone.message)}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          {/* `id` rather than `htmlFor`: this names the trigger through
              aria-labelledby, because a <label for> does not name a button. */}
          <Label id={subjectLabelId}>{t('subject')} *</Label>
          <Controller
            name="subject"
            control={control}
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger
                  ref={subjectTriggerRef}
                  id={subjectTriggerId}
                  className="w-full"
                  // The accessible name. Measured as "" before this line.
                  aria-labelledby={subjectLabelId}
                  aria-invalid={!!errors.subject}
                  aria-describedby={errors.subject ? subjectErrorId : undefined}
                  data-testid="contact-subject-trigger"
                >
                  <SelectValue placeholder={t('selectSubject')} />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`subjects.${s.toLowerCase()}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.subject && (
            <p id={subjectErrorId} className="text-sm text-destructive">
              {messageFor(errors.subject.message)}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="c-message">{t('message')} *</Label>
          <Textarea
            id="c-message"
            rows={5}
            placeholder={t('messagePlaceholder')}
            aria-invalid={!!errors.message}
            aria-describedby={errors.message ? 'c-message-error' : undefined}
            {...register('message')}
          />
          {errors.message && (
            <p id="c-message-error" className="text-sm text-destructive">
              {messageFor(errors.message.message)}
            </p>
          )}
        </div>

        {/* Consent. Required, and its timestamp is stored with the request -
            the server's clock, because a consent time supplied by a browser is
            a claim rather than a record. */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-3">
            <Controller
              name="consent"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="c-consent"
                  checked={field.value === true}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  aria-invalid={!!errors.consent}
                  aria-describedby={errors.consent ? consentErrorId : undefined}
                  className="mt-0.5"
                />
              )}
            />
            <Label htmlFor="c-consent" className="text-sm leading-relaxed font-normal">
              {t('consentBefore')}
              <Link
                href={PRIVACY_POLICY_PATH}
                className="text-primary-600 underline underline-offset-2"
              >
                {t('consentLink')}
              </Link>
              {t('consentAfter')}
            </Label>
          </div>
          {errors.consent && (
            <p id={consentErrorId} className="text-sm text-destructive">
              {messageFor(errors.consent.message)}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t('sending') : t('send')}
        </Button>
      </form>
    </div>
  );
};
