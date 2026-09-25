/**
 * Centralized formatting utilities for monetary amounts and dates.
 */

/**
 * Formats a monetary amount with its ISO currency code safely using Intl.NumberFormat.
 */
export const formatMoney = (amount: bigint | number, currency: string, locale = 'fr-FR'): string =>
  // Format BigInt directly using Intl.NumberFormat to prevent precision loss.
  `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)} ${currency}`;

/** Formats a date into long form based on the locale, defaulting to '—' if invalid. */
export const formatHumanDate = (at: Date | string | null | undefined, locale = 'fr-FR'): string => {
  if (!at) return '—';
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    d,
  );
};

/** Formats a date and time into a human-readable long form based on the locale. */
export const formatHumanDateTime = (
  at: Date | string | null | undefined,
  locale = 'fr-FR',
): string => {
  if (!at) return '—';
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

/** Regular expression matching an ISO date format. */
export const ISO_DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;
