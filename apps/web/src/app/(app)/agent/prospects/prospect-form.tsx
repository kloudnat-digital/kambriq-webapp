'use client';

import { useId, useRef, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { KamnetLeadSource } from '@kambriq/common/constants/kamnet';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToastStore } from '@/store/toast.store';
import { createLead, updateLead } from '@/lib/actions/kamnet';
import { ProspectFormResolver, type ProspectFormSchema } from '@/validations/schema/prospect';
import type { Lead } from '@/types/kamnet';

/**
 * Create or edit a prospect.
 *
 * ---------------------------------------------------------------------------
 * The source field is not `required`
 * ---------------------------------------------------------------------------
 * `L1` established why, and it cost a day: a `required` attribute on a Radix
 * `Select` renders a native `<select required>` at 1x1 pixels, `aria-hidden`,
 * behind the visible trigger. Native constraint validation then blocks the
 * submit for a control the browser can neither focus nor annotate - no message,
 * no highlight, and the handler never runs. The button does nothing, silently.
 *
 * So the rule lives in the resolver, the message renders under the trigger tied
 * by `aria-describedby`, `aria-invalid` marks it, and the trigger carries an
 * accessible name through `aria-labelledby` - a `<label for>` does not name a
 * `<button role="combobox">`.
 *
 * ---------------------------------------------------------------------------
 * Nothing is reset on failure
 * ---------------------------------------------------------------------------
 * An agent who typed a client's details and got a refusal keeps what they
 * typed, for the same reason the contact form keeps a prospect's message.
 */

interface Props {
  mode: 'create' | 'edit';
  lead?: Lead;
  onClose: () => void;
}

const SOURCES = [
  KamnetLeadSource.SOCIAL_MEDIA,
  KamnetLeadSource.REFERRAL,
  KamnetLeadSource.EVENT,
  KamnetLeadSource.OTHER,
] as const;

export const ProspectForm = ({ mode, lead, onClose }: Props) => {
  const t = useTranslations('app.prospects');
  const { createToast } = useToastStore();
  const [pending, startTransition] = useTransition();

  const ids = useId();
  const sourceLabelId = `${ids}-source-label`;
  const sourceTriggerId = `${ids}-source-trigger`;
  const sourceErrorId = `${ids}-source-error`;
  const sourceTriggerRef = useRef<HTMLButtonElement>(null);

  const {
    control,
    handleSubmit,
    register,
    setFocus,
    formState: { errors },
  } = useForm<ProspectFormSchema>({
    resolver: zodResolver(ProspectFormResolver),
    defaultValues: {
      clientName: lead?.clientName ?? '',
      clientEmail: lead?.clientEmail ?? '',
      clientPhone: lead?.clientPhone ?? '',
      source: (lead?.source as ProspectFormSchema['source']) ?? undefined,
      notes: lead?.notes ?? '',
    },
  });

  const messageFor = (key?: string) => (key ? t(`errors.${key}` as never) : undefined);

  const onSubmit = (values: ProspectFormSchema) =>
    startTransition(async () => {
      // `mode === 'edit'` guarantees a lead, but the type does not say so, and a
      // non-null assertion would be the compiler agreeing with a claim nothing
      // checks. Narrowed instead, so the impossible branch is visible.
      if (mode === 'edit' && !lead) {
        createToast({ status: 'error', title: t('failed') });
        return;
      }

      const result =
        mode === 'create' || !lead
          ? await createLead(values, '/agent/prospects')
          : await updateLead(lead.id, values, '/agent/prospects');

      if (!result.success) {
        createToast({ status: 'error', title: result.error ?? t('failed') });
        return;
      }
      createToast({
        status: 'success',
        title: mode === 'create' ? t('created') : t('updated'),
      });
      onClose();
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t('create') : t('edit')}</DialogTitle>
          <DialogDescription>{t('subtitle')}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit, () => {
            if (errors.source) sourceTriggerRef.current?.focus();
            else setFocus('clientName');
          })}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-name`}>{t('fields.clientName')}</Label>
            <Input
              id={`${ids}-name`}
              {...register('clientName')}
              aria-invalid={Boolean(errors.clientName)}
              aria-describedby={errors.clientName ? `${ids}-name-error` : undefined}
            />
            {errors.clientName && (
              <p id={`${ids}-name-error`} className="text-xs text-destructive">
                {messageFor(errors.clientName.message)}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-email`}>{t('fields.clientEmail')}</Label>
              <Input
                id={`${ids}-email`}
                type="email"
                {...register('clientEmail')}
                aria-invalid={Boolean(errors.clientEmail)}
                aria-describedby={errors.clientEmail ? `${ids}-email-error` : undefined}
              />
              {errors.clientEmail && (
                <p id={`${ids}-email-error`} className="text-xs text-destructive">
                  {messageFor(errors.clientEmail.message)}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-phone`}>{t('fields.clientPhone')}</Label>
              <Input
                id={`${ids}-phone`}
                {...register('clientPhone')}
                aria-invalid={Boolean(errors.clientPhone)}
                aria-describedby={errors.clientPhone ? `${ids}-phone-error` : undefined}
              />
              {errors.clientPhone && (
                <p id={`${ids}-phone-error`} className="text-xs text-destructive">
                  {messageFor(errors.clientPhone.message)}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label id={sourceLabelId}>{t('fields.source')}</Label>
            <Controller
              control={control}
              name="source"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id={sourceTriggerId}
                    ref={sourceTriggerRef}
                    aria-labelledby={sourceLabelId}
                    aria-invalid={Boolean(errors.source)}
                    aria-describedby={errors.source ? sourceErrorId : undefined}
                  >
                    <SelectValue placeholder={t('fields.source')} />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`source.${s}` as never)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.source && (
              <p id={sourceErrorId} className="text-xs text-destructive">
                {messageFor(errors.source.message)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-notes`}>{t('fields.notes')}</Label>
            <Textarea
              id={`${ids}-notes`}
              rows={4}
              {...register('notes')}
              aria-invalid={Boolean(errors.notes)}
              aria-describedby={errors.notes ? `${ids}-notes-error` : undefined}
            />
            {errors.notes && (
              <p id={`${ids}-notes-error`} className="text-xs text-destructive">
                {messageFor(errors.notes.message)}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
