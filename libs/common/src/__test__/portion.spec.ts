import { depositFor } from '../payments/deposit';
import { fitsIn, parcelStatusFor, portionPrice, surfaceLeft } from '../payments/portion';

/**
 * C49 - a portion costs the parcel's total in proportion to its surface,
 * `round(totalPrice x purchasedM2 / sizeM2)`, in whole XAF.
 */
describe('C49 - portionPrice', () => {
  it('prices 400 m2 of fiche 006 (2 750 m2, 22 000 000) at 3 200 000, deposit 160 000', () => {
    const amount = portionPrice(22_000_000n, 400, 2_750);
    expect(amount).toBe(3_200_000n);
    expect(depositFor(Number(amount))).toBe(160_000);
  });

  it('prices the whole parcel at exactly its total, whatever the rounding of its rate', () => {
    // 9 800 000 over 300 m2 is 32 666.67 per m2: the rate rounds, the whole does not.
    expect(portionPrice(9_800_000n, 300, 300)).toBe(9_800_000n);
    expect(portionPrice(4_920_000n, 492, 492)).toBe(4_920_000n);
  });

  it('rounds half up to the franc', () => {
    // 1 000 x 1 / 8 = 125 exactly; 1 001 x 1 / 2 = 500.5 -> 501.
    expect(portionPrice(1_000n, 1, 8)).toBe(125n);
    expect(portionPrice(1_001n, 1, 2)).toBe(501n);
    expect(portionPrice(1_000n, 1, 3)).toBe(333n);
  });

  it('stays exact where a floating-point product would not', () => {
    // 13 ha 57 a 04 ca at 15 000 F/m2: 2 035 560 000; a third of it.
    const total = 2_035_560_000n;
    expect(portionPrice(total, 45_234.667, 135_704)).toBe(678_520_005n); // 15 000 x 45 234.667
    expect(portionPrice(98_765_432_109n, 1, 3)).toBe(32_921_810_703n);
  });

  it('keeps the sum of portions within one franc per portion of the total (declared, not guarded)', () => {
    const total = 9_800_000n;
    const parts = [100, 100, 100];
    const sum = parts.reduce((s, p) => s + portionPrice(total, p, 300), 0n);
    expect(sum - total).toBeGreaterThanOrEqual(-BigInt(parts.length));
    expect(sum - total).toBeLessThanOrEqual(BigInt(parts.length));
  });

  it('refuses a portion that is empty or larger than its parcel, and a parcel with no surface', () => {
    expect(() => portionPrice(1_000n, 0, 10)).toThrow(RangeError);
    expect(() => portionPrice(1_000n, 11, 10)).toThrow(RangeError);
    expect(() => portionPrice(1_000n, 1, 0)).toThrow(RangeError);
  });
});

describe('C49 - the surface left, and the parcel status it implies', () => {
  const held = (
    purchasedM2: number,
    status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED',
  ) => ({
    purchasedM2,
    status,
  });

  it('counts every portion not cancelled, completed ones included', () => {
    expect(surfaceLeft(1_000, [held(600, 'PENDING'), held(300, 'CANCELLED')])).toBe(400);
    expect(surfaceLeft(1_000, [held(600, 'COMPLETED'), held(400, 'CONFIRMED')])).toBe(0);
  });

  it('leaves no phantom sliver from floating-point sums', () => {
    expect(
      surfaceLeft(0.3, [held(0.1, 'PENDING'), held(0.1, 'PENDING'), held(0.1, 'PENDING')]),
    ).toBe(0);
    expect(fitsIn(0.1, 0.30000000000000004 - 0.2)).toBe(true);
  });

  it('keeps a parcel AVAILABLE while ground is left, RESERVED when none is, SOLD when all is sold', () => {
    expect(parcelStatusFor(1_000, [])).toBe('AVAILABLE');
    expect(parcelStatusFor(1_000, [held(600, 'PENDING')])).toBe('AVAILABLE');
    expect(parcelStatusFor(1_000, [held(600, 'COMPLETED'), held(400, 'PENDING')])).toBe('RESERVED');
    expect(parcelStatusFor(1_000, [held(600, 'COMPLETED'), held(400, 'COMPLETED')])).toBe('SOLD');
    // A whole-parcel sale behaves as before: RESERVED, then SOLD on completion.
    expect(parcelStatusFor(500, [held(500, 'PENDING')])).toBe('RESERVED');
    expect(parcelStatusFor(500, [held(500, 'COMPLETED')])).toBe('SOLD');
    expect(parcelStatusFor(500, [held(500, 'CANCELLED')])).toBe('AVAILABLE');
  });

  it('fits a portion only within what is left', () => {
    expect(fitsIn(400, 400)).toBe(true);
    expect(fitsIn(400.001, 400)).toBe(false);
    expect(fitsIn(0, 400)).toBe(false);
  });
});
