/**
 * Apply a decimal coefficient to an XAF integer using safe integer math.
 * Used for commission calculations: price × pv (Point Valeur, 0.1–2.0).
 *
 * Example: applyCoefficient(7_500_000, 1.2) -> 9_000_000
 */
export const applyCoefficient = (priceXAF: number, coefficient: number): number => {
  const scale = (coefficient.toString().split('.')[1] ?? '').length;
  const factor = Math.round(coefficient * 10 ** scale);
  return Math.round((priceXAF * factor) / 10 ** scale);
};

/**
 * Format an XAF integer for display (e.g. in email templates or API responses).
 * Output: "7 500 000 FCFA"
 */
export const formatXAF = (amount: number, locale = 'fr-FR'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'XAF',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Compact format for short representations.
 * Output: "7,5M FCFA"
 */
export const formatXAFCompact = (amount: number, locale = 'fr-FR'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'XAF',
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
};
