/**
 * Kept free of generated Prisma code, so the web can import it
 * (`web-reachable-common-has-no-generated-code.spec.ts`).
 */
export const DOWN_PAYMENT_PERCENT = 5 as const; // 5% of the parcel's total price

/**
 * The deposit on a parcel: `DOWN_PAYMENT_PERCENT` of its TOTAL price, in whole
 * XAF (no minor unit). Never of a price per m2 (G19). The API charges it and the
 * web estimates it through this one function.
 */
export const depositFor = (totalPrice: number): number =>
  Math.round((totalPrice * DOWN_PAYMENT_PERCENT) / 100);

/**
 * What remains after the deposit: the total price minus `depositFor`, so the
 * two always add up to the total exactly, whatever the deposit's rounding (G20).
 */
export const balanceFor = (totalPrice: number): number => totalPrice - depositFor(totalPrice);
