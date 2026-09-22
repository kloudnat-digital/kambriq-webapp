'use client';

import { useId, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { setMyPublicListing } from '@/lib/actions/kamnet';
import { useToastStore } from '@/store/toast.store';

/**
 * P11 - the agent's own switch into the public directory.
 *
 * ---------------------------------------------------------------------------
 * It never moves optimistically
 * ---------------------------------------------------------------------------
 * The box reflects what the server confirmed, and nothing else. An optimistic
 * flip would show "you are listed" to somebody whose write failed - the same
 * defect as the contact form that raised a success toast after
 * `setTimeout(800)` and sent nothing, and worse here, because the thing being
 * misreported is whether a real person's name and city are on a public page.
 *
 * On failure the box stays where it was and an error toast says so. On success
 * it moves and the toast says which way.
 *
 * ---------------------------------------------------------------------------
 * The text is not decoration
 * ---------------------------------------------------------------------------
 * `listingPublished` enumerates every field that becomes public, and
 * `listingWithdraw` states that consent can be taken back at any time and that
 * withdrawal is immediate. Consent to publish somebody's identity is only
 * consent if they were told what is published; both strings are tied to the
 * control with `aria-describedby` so a screen reader reaches them from the
 * checkbox rather than only by reading the page in order.
 */
export const PublicListingControl = ({
  listedSince,
  suspended,
}: {
  listedSince: string | null;
  suspended: boolean;
}) => {
  const t = useTranslations('app.agentProfile');
  const { createToast } = useToastStore();

  const ids = useId();
  const checkboxId = `${ids}-listed`;
  const publishedId = `${ids}-published`;
  const withdrawId = `${ids}-withdraw`;

  const [since, setSince] = useState<string | null>(listedSince);
  const [pending, startTransition] = useTransition();

  const listed = since !== null;

  const change = (next: boolean) => {
    startTransition(async () => {
      const result = await setMyPublicListing(next);

      if (!result.success) {
        createToast({ status: 'error', title: t('saveFailed') });
        return;
      }

      setSince(result.data.publicListingConsentAt);
      createToast({
        status: 'success',
        title: result.data.publicListingConsentAt ? t('savedOn') : t('savedOff'),
      });
    });
  };

  return (
    <section
      data-listing-control
      data-listed={listed}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <h2 className="text-lg font-semibold text-foreground">{t('listingTitle')}</h2>

      <div className="mt-5 flex items-start gap-3">
        <Checkbox
          id={checkboxId}
          checked={listed}
          disabled={pending || suspended}
          onCheckedChange={(next) => change(next === true)}
          aria-describedby={`${publishedId} ${withdrawId}`}
        />
        <Label htmlFor={checkboxId} className="leading-snug font-medium">
          {t('listingLabel')}
        </Label>
      </div>

      <p className="mt-4 text-sm text-muted-foreground" id={publishedId}>
        {t('listingPublished')}
      </p>
      <p className="mt-3 text-sm text-muted-foreground" id={withdrawId}>
        {t('listingWithdraw')}
      </p>

      <p className="mt-4 text-sm font-medium text-foreground" data-listing-state>
        {listed ? t('listingOn', { date: formatDay(since as string) }) : t('listingOff')}
      </p>

      <p className="mt-2 text-xs text-muted-foreground">{t('listingRequires')}</p>
    </section>
  );
};

/**
 * The consent date, as a day.
 *
 * `toLocaleDateString` with no locale argument follows the runtime's, which in
 * a client component is the reader's browser - which is what is wanted here and
 * is why this does not reach for the server-side formatter.
 */
const formatDay = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString();
};
