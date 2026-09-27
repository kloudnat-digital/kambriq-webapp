import { exactMoney } from '../journeys/support';

/**
 * The journeys' test for "this amount arrived exact". Unit-tested here because a
 * smoke test's own check is the part nobody sees fail: were it too lax, every
 * journey would stay green over the defect it exists to catch.
 */
describe('exactMoney - an amount arrives as a whole, exact JSON number', () => {
  it('accepts whole francs', () => {
    expect(exactMoney(8_000_000)).toBe(true);
    expect(exactMoney(0)).toBe(true);
  });

  it('refuses a string, which is what a BigInt past the exact range becomes', () => {
    expect(exactMoney('8000000')).toBe(false);
  });

  it('refuses a fraction, which is what a Float column lets through', () => {
    expect(exactMoney(400_000.6)).toBe(false);
  });

  it('refuses a number past the exact range, and anything absent', () => {
    expect(exactMoney(2 ** 60)).toBe(false);
    expect(exactMoney(null)).toBe(false);
    expect(exactMoney(undefined)).toBe(false);
    expect(exactMoney(Number.NaN)).toBe(false);
  });
});
