/**
 * Applies a decimal coefficient to an XAF integer using safe integer arithmetic.
 *
 * @param priceXAF - The base price in XAF.
 * @param coefficient - The decimal multiplier.
 * @returns The computed product.
 */
export const applyCoefficient = (priceXAF: number, coefficient: number): number => {
  const scale = (coefficient.toString().split('.')[1] ?? '').length;
  const factor = Math.round(coefficient * 10 ** scale);
  return Math.round((priceXAF * factor) / 10 ** scale);
};

/**
 * Formats an XAF integer into a localized string representation.
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
 * Formats an XAF integer into a compact, localized string representation.
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
