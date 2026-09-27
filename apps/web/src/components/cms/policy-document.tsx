import { getTranslations } from 'next-intl/server';
import type { KbsLabelLanguage } from '@kambriq/common/kbs/label-definitions';
import type { CmsDocument } from '@/lib/cms/documents';
import { CmsBody } from './portable-text';

/**
 * A legal document: its title, when the wording took effect, and its text.
 *
 * The title and the date are FIELDS, not the first two lines of the body. The
 * markdown carried both as prose, and a date written in the text is a second
 * record of `publishedAt` - the day they disagree, nothing says which one the
 * reader is entitled to rely on. The migration dropped the line after checking
 * it agreed with the field.
 *
 * The date is rendered with `Intl` in the reader's language, which is how this
 * repository writes any date somebody acts on.
 */
export async function PolicyDocument({
  document,
  locale,
}: {
  document: CmsDocument;
  locale: KbsLabelLanguage;
}) {
  const t = await getTranslations('legal');

  const effective = document.publishedAt
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
        new Date(document.publishedAt),
      )
    : null;

  return (
    <article>
      {document.title ? (
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          {document.title}
        </h1>
      ) : null}
      {effective ? (
        <p className="mb-8 text-sm text-gray-500 italic">{t('lastUpdated', { date: effective })}</p>
      ) : null}
      <CmsBody body={document.body} language={locale} />
    </article>
  );
}
