/**
 * Baseline KCA1 training fee in euros.
 * Dictates the XAF (FCFA) price to prevent currency drift.
 */
export const KCA1_PRICE_EUR = 249 as const;

/** Fixed EUR-to-XAF conversion parity. */
export const EUR_TO_XAF_PARITY = 655.957 as const;

/** Computed XAF price, floored to the nearest whole franc (no minor unit). */
export const KCA1_PRICE_XAF = Math.floor(KCA1_PRICE_EUR * EUR_TO_XAF_PARITY);

/** XAF price formatted with space-separated thousands. */
export const KCA1_PRICE_XAF_DISPLAY = String(KCA1_PRICE_XAF).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
