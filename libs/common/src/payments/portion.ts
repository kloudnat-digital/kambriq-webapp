/**
 * C49 - what a sale costs: the parcel's total in proportion to the surface it
 * buys, `round(totalPrice x purchasedM2 / sizeM2)`, in whole XAF.
 *
 * Pro rata of the TOTAL, not the rounded price per m2 (G19): each portion is
 * right to within 1 F, the whole parcel costs exactly its total, and no honest
 * row is ever refused. The sum of several portions may differ from the total by
 * up to one franc per portion; that is accepted and declared (Visquis, 2
 * October), not guarded against - an exact-match rule refuses honest round
 * totals.
 *
 * Exact arithmetic: the product of a total and a surface can pass 2^53, so the
 * computation runs on integers. Surfaces are taken to the thousandth of a m2,
 * finer than any survey. Rounding is half up, as Postgres `ROUND` does on the
 * positive values money takes.
 *
 * Kept free of generated Prisma code, so the web can import it
 * (`web-reachable-common-has-no-generated-code.spec.ts`).
 */
const MILLI = 1000;

const toMilli = (m2: number): bigint => BigInt(Math.round(m2 * MILLI));

export const portionPrice = (totalPrice: bigint, purchasedM2: number, sizeM2: number): bigint => {
  const part = toMilli(purchasedM2);
  const whole = toMilli(sizeM2);
  if (whole <= 0n) throw new RangeError('A parcel with no surface has no price per portion.');
  if (part <= 0n) throw new RangeError('A portion buys some ground.');
  if (part > whole) throw new RangeError('A portion cannot be larger than its parcel.');
  if (totalPrice < 0n) throw new RangeError('A total price is not negative.');
  return (2n * totalPrice * part + whole) / (2n * whole);
};
