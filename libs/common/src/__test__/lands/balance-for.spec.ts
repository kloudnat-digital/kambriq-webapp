import { balanceFor, depositFor } from '../../payments/deposit';

/**
 * G20 - the balance a client owes after the deposit, from the parcel's total
 * price (G19 made that figure unambiguous). The balance payment itself waits on
 * a decision about telling a deposit from a balance on the ledger; the amount
 * does not.
 */
describe('G20 - the balance', () => {
  it('is the total minus the deposit: 3 400 000 gives 3 230 000', () => {
    expect(balanceFor(3_400_000)).toBe(3_230_000);
  });

  it('and deposit plus balance is exactly the total, with the deposit rounded', () => {
    expect(depositFor(3_400_010) + balanceFor(3_400_010)).toBe(3_400_010);
  });
});
