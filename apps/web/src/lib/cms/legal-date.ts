/**
 * C41 - the day a legal text takes effect, as a reader in Cameroon reads it.
 *
 * Revisions are dated at local midnight - the privacy policy's is
 * `2026-10-19T00:00:00+01:00` - and the server renders in UTC, where that
 * instant is still 18 October. Formatted without a zone, the page said "18
 * octobre" for a text in force from the 19th, which on a notice of entry into
 * force is the one wrong word that matters. The zone is the one the dates are
 * written in: West Africa Time, Douala.
 */
export const LEGAL_TIME_ZONE = 'Africa/Douala';

export const legalDate = (iso: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: LEGAL_TIME_ZONE,
  }).format(new Date(iso));
