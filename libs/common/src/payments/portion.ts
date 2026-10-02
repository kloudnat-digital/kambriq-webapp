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

/** A sale on a parcel, as far as its surface is concerned. */
export interface PortionHold {
  readonly purchasedM2: number;
  readonly status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
}

const heldMilli = (portions: readonly PortionHold[], which: (p: PortionHold) => boolean) =>
  portions.filter(which).reduce((sum, p) => sum + toMilli(p.purchasedM2), 0n);

/**
 * C49 - the surface still for sale on a parcel: its surface minus every portion
 * not cancelled, completed ones included. Never negative. Computed to the
 * thousandth of a m2 on integers, so three portions of 0.1 do not leave a
 * phantom sliver.
 */
export const surfaceLeft = (sizeM2: number, portions: readonly PortionHold[]): number => {
  const left = toMilli(sizeM2) - heldMilli(portions, (p) => p.status !== 'CANCELLED');
  return left > 0n ? Number(left) / MILLI : 0;
};

/**
 * C49 - a parcel's status follows its portions, not its first reservation:
 * SOLD once every m2 is in a completed sale; RESERVED once no surface is left
 * but not all of it is sold; AVAILABLE while any surface is left - so a parcel
 * with ground left stays listed for agents.
 */
export const parcelStatusFor = (
  sizeM2: number,
  portions: readonly PortionHold[],
): 'AVAILABLE' | 'RESERVED' | 'SOLD' => {
  if (heldMilli(portions, (p) => p.status === 'COMPLETED') >= toMilli(sizeM2)) return 'SOLD';
  return surfaceLeft(sizeM2, portions) > 0 ? 'AVAILABLE' : 'RESERVED';
};

/** Whether `purchasedM2` fits in what is left, compared on the same integer grid. */
export const fitsIn = (purchasedM2: number, leftM2: number): boolean =>
  toMilli(purchasedM2) > 0n && toMilli(purchasedM2) <= toMilli(leftM2);
