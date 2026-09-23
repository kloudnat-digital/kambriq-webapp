/**
 * Formatting utilities for displaying monetary amounts and dates to users.
 *
 * Provides centralized functions to ensure consistent formatting across the application,
 * preventing duplication of currency symbols and ensuring human-readable date formats.
 */

/**
 * Formats a monetary amount with its corresponding ISO currency code.
 *
 * Ensures the currency is appended exactly once. Supports large integers safely.
 */
export const formatMoney = (amount: bigint | number, currency: string, locale = 'fr-FR'): string =>
  // Format BigInt directly using Intl.NumberFormat to prevent precision loss.
  `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)} ${currency}`;

/**
 * Formats a date into a human-readable long form based on the locale.
 *
 * Returns an em-dash ('—') if the provided date is null or invalid.
 */
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
