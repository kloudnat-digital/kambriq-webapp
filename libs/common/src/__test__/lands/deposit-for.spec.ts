import { depositFor } from '../../payments/deposit';

/**
 * G19 - the deposit is a share of the parcel's TOTAL price, and nothing else.
 * The web's estimate multiplied by the surface first and showed a deposit 480
 * times too large on a 480 m2 parcel; the API was right. One rule, one home.
 */
describe('G19 - the deposit', () => {
  it('is 5 % of the total: the diagnosis parcel, 3 400 000 over 480 m2, gives 170 000', () => {
    expect(depositFor(3_400_000)).toBe(170_000);
  });

  it('is whole francs: XAF has no minor unit', () => {
    expect(depositFor(3_400_010)).toBe(170_001);
  });
});
