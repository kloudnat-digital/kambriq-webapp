import { PaymentState } from '../../payments/payment-state';
import { outstandingOf } from '../../payments/payment-state';

/**
 * G22 - what a payment still asks for. A payment that was annulled, rejected or
 * expired asks for nothing: showing its amount due as outstanding reads as
 * money still owed. Money it did receive stays in its ledger (`amountReceived`).
 */
describe('G22 - outstanding is what a payment still asks for', () => {
  it.each([PaymentState.ANNULE, PaymentState.REJETE, PaymentState.EXPIRE])(
    'a %s payment has nothing outstanding, whatever it received',
    (state) => {
      expect(outstandingOf(state, 750_000n, 0n)).toBe(0n);
      expect(outstandingOf(state, 750_000n, 300_000n)).toBe(0n);
    },
  );

  it.each([
    PaymentState.INITIE,
    PaymentState.INSTRUCTIONS_ENVOYEES,
    PaymentState.ANNONCE_CLIENT,
    PaymentState.EN_VERIFICATION,
    PaymentState.PARTIELLEMENT_RECU,
    PaymentState.VALIDE,
  ])('a %s payment still asks for its amount due less what arrived', (state) => {
    expect(outstandingOf(state, 750_000n, 300_000n)).toBe(450_000n);
  });
});
