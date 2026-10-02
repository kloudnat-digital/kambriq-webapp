import { getTranslations } from 'next-intl/server';
import type { KbsLabelLanguage } from '@kambriq/common/kbs/label-definitions';
import type { PolicyStanding } from '@/lib/cms/policy-standing';

const longDate = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(iso),
  );

/**
 * C41 - the revision in force, read from the API's archive, while Sanity holds
 * one dated in the future. The archive keeps the text exactly as it was
 * rendered when it was published, which is what a reader was shown and is
 * entitled to rely on; the next revision is announced with its date.
 */
export async function ArchivedPolicy({
  title,
  inForce,
  upcoming,
  locale,
}: {
  title: string | null | undefined;
  inForce: NonNullable<PolicyStanding['inForce']>;
  upcoming: string | null | undefined;
  locale: KbsLabelLanguage;
}) {
  const t = await getTranslations('legal');

  return (
    <article>
      {title ? (
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
      ) : null}
      <p className="mb-2 text-sm text-muted-foreground italic">
        {t('lastUpdated', { date: longDate(inForce.publishedAt, locale) })}
      </p>
      {upcoming ? (
        <p
          data-testid="policy-next-revision"
          className="mb-8 rounded-md bg-gold-50 p-3 text-sm font-medium text-gold-900 ring-1 ring-gold-200"
        >
          {t('nextRevision', { date: longDate(upcoming, locale) })}
        </p>
      ) : null}
      <div
        className="prose max-w-none"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: rendered by the API from our own Sanity document at publication and archived append-only.
        dangerouslySetInnerHTML={{ __html: inForce.rendered }}
      />
    </article>
  );
}
