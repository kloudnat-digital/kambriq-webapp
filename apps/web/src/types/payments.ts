/** G4 - the back-office payment shapes, as the API returns them. */

export type PaymentState =
  | 'INITIE'
  | 'INSTRUCTIONS_ENVOYEES'
  | 'ANNONCE_CLIENT'
  | 'EN_VERIFICATION'
  | 'PARTIELLEMENT_RECU'
  | 'VALIDE'
  | 'REJETE'
  | 'EXPIRE'
  | 'ANNULE';

export type PaymentChannel =
  | 'VIREMENT'
  | 'MOBILE_MONEY'
  | 'ESPECES'
  | 'ACTE_NOTARIE'
  | 'INCONNU_HISTORIQUE';

/**
 * Amounts are strings, all the way to the screen.
 *
 * `BigInt` does not survive `JSON.stringify`, and parsing a monetary amount
 * into a JavaScript number is the `Float` defect G1 removed from the schema,
 * reintroduced at the edge. They are formatted from the string and never
 * arithmetic'd in the browser.
 */
export interface PaymentRow {
  id: string;
  reference: string | null;
  reservationId: string;
  state: PaymentState;
  currency: string;
  amountDue: string;
  amountReceived: string;
  outstanding: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface PaymentReceipt {
  id: string;
  amount: string;
  currency: string;
  channel: PaymentChannel;
  receivedAt: string;
  recordedAt: string;
  recordedBy: string;
  evidenceUrl: string | null;
  correctsId: string | null;
  note: string | null;
}

export interface PaymentTransition {
  id: string;
  fromState: PaymentState | null;
  toState: PaymentState;
  actorUserId: string;
  reason: string;
  evidenceReceiptId: string | null;
  occurredAt: string;
}

export interface PaymentDetail extends PaymentRow {
  receipts: PaymentReceipt[];
  transitions: PaymentTransition[];
}
