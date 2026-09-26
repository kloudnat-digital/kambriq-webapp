/**
 * What a payment pays for (G20). Mirrors `PaymentPurpose` in
 * prisma/lands/schema.prisma.
 *
 * An enum, like `PaymentState` and `PaymentChannel`, never a boolean or free
 * text: a third purpose (a fee, a refund) is expected one day. The deposit gate
 * and the balance gate each ask for their own purpose, so a validated balance
 * can never stand in for a deposit.
 */
export enum PaymentPurpose {
  /** The deposit, `depositFor(totalPrice)`, that confirms the reservation. */
  ACOMPTE = 'ACOMPTE',
  /** The balance: the total minus what the deposit actually received. */
  SOLDE = 'SOLDE',
}
