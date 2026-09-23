/**
 * The published KCA1 training fee in whole euros.
 * The XAF (FCFA) price is strictly derived from this value to prevent drift.
 */
export const KCA1_PRICE_EUR = 249 as const;

/**
 * Fixed XAF per EUR parity rate.
 */
export const EUR_TO_XAF_PARITY = 655.957 as const;

/**
 * The computed price in XAF.
 * Rounded down to the nearest whole franc since XAF has no minor unit.
 */
export const KCA1_PRICE_XAF = Math.floor(KCA1_PRICE_EUR * EUR_TO_XAF_PARITY);

/**
 * The XAF price formatted for display using spaces as thousands separators.
 */
export const KCA1_PRICE_XAF_DISPLAY = String(KCA1_PRICE_XAF).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
