'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { submitKamnetApplication } from '@/lib/actions/kamnet';

/**
 * P5 - the one state of `/kamnet/apply` that submits. It says nothing about
 * success itself: on a stored application the page re-renders from the API and
 * shows the application's real status. A refusal is shown where it happened.
 */
export function ApplyForm({ kcaNumber }: { kcaNumber: string }) {
  const t = useTranslations('kamnetApply.form');
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSending(true);
    setError(null);
    const result = await submitKamnetApplication({
      sponsorCode: String(data.get('sponsorCode') ?? ''),
      motivation: String(data.get('motivation') ?? ''),
    });
    setSending(false);
    if (result.success) router.refresh();
    else setError(result.error);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-2xl border border-border bg-white p-8 shadow-sm"
    >
      <p className="text-sm text-gray-700">{t('intro', { kcaNumber })}</p>
      <div className="space-y-1.5">
        <Label htmlFor="apply-sponsor">{t('sponsorLabel')}</Label>
        <Input id="apply-sponsor" name="sponsorCode" className="font-mono" />
        <p className="text-xs text-gray-500">{t('sponsorHelp')}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="apply-motivation">{t('motivationLabel')}</Label>
        <Textarea
          id="apply-motivation"
          name="motivation"
          rows={5}
          required
          minLength={50}
          maxLength={1000}
        />
        <p className="text-xs text-gray-500">{t('motivationHelp')}</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t('error', { message: error })}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={sending}>
        {sending ? t('sending') : t('submit')}
      </Button>
    </form>
  );
}
