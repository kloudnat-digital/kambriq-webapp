/**
 * Money utilities for the web app.
 * XAF (CFA Franc BEAC) has no subunits - amounts are always whole integers.
 */

export const formatXAF = (amount: number, locale = 'fr-FR'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'XAF',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatXAFCompact = (amount: number, locale = 'fr-FR'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'XAF',
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
};
