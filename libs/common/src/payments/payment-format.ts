/**
 * How money and dates are shown to a person. One function each.
 *
 * Both exist because of defects that shipped this week, in messages a client
 * actually received:
 *
 * - `G3` sent **"750 000 FCFA XAF"** - the currency twice - because `formatXAF`
 *   appends "FCFA" itself and was composed with the payment's own currency. It
 *   reads correctly at the call site and wrong in the inbox;
 * - `G3` sent the deadline as **"2026-10-06"**. ISO is a machine's format. A
 *   date somebody has to act on is written the way they write dates.
 *
 * The fix is not "be careful". It is that there is **one** function for each,
 * and `payment-format.spec.ts` fails if a rendered amount carries its currency
 * twice or if a human-facing string carries an ISO date.
 */

/**
 * An amount, with its currency exactly once.
 *
 * The currency is the payment's own ISO code, never a hardcoded symbol: a
 * helper that assumes XAF is wrong the day anything is priced in EUR, and it is
 * wrong silently.
 */
export const formatMoney = (amount: bigint | number, currency: string, locale = 'fr-FR'): string =>
  // `Intl.NumberFormat.format` takes a BigInt directly and formats it exactly.
  // The first version of this line wrote `Number(amount)` and rounded above
  // 2^53 - 9 007 199 254 740 993 rendered as ...992. **That is the Float defect
  // G1 removed from the schema, reintroduced inside the formatter written to
  // prevent it**, and it was caught by a test asserting an exact large value
  // rather than a plausible small one.
  `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)} ${currency}`;

/**
 * A date, long form, in the reader's language. Never ISO.
 *
 * `null` renders as an em-dash rather than an empty string: a blank in a date
 * position reads as a rendering fault, where a dash reads as "none".
 */
export const formatHumanDate = (at: Date | string | null | undefined, locale = 'fr-FR'): string => {
  if (!at) return '—';
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    d,
  );
};

/** The same, with the time, for an audit trail where ordering matters. */
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

/** Anything that looks like an ISO date. Used by the guard test and by callers. */
export const ISO_DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;
