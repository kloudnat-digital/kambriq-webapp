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

export type PaymentChannel = 'VIR' | 'DEPO' | 'OMO' | 'MOMO' | 'ESP' | 'NOTA' | 'HIST';

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
  paidBy: string | null;
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
  channel: PaymentChannel | null;
  occurredAt: string;
}

export interface PaymentDetail extends PaymentRow {
  /** The client's wish, shown decided or not (v03 4c). Binds nothing. */
  preferredChannel: PaymentChannel | null;
  /** What the back office chose and communicated. Null until sent. */
  channel: PaymentChannel | null;
  clientUserId: string | null;
  identityStatus: 'none' | 'pending' | 'verified' | 'rejected';
  receipts: PaymentReceipt[];
  transitions: PaymentTransition[];
}

/** One row of the back-office request queue (v03 4d). */
export type PaymentRequestRow = {
  id: string;
  reference: string | null;
  clientName: string | null;
  clientUserId: string | null;
  subject: string | null;
  currency: string;
  amountDue: string;
  /** The client's wish. Shown, never preselected into the decision. */
  preferredChannel: PaymentChannel | null;
  identityStatus: 'none' | 'pending' | 'verified' | 'rejected';
  /** Whether a send would be refused right now. */
  blockedByIdentity: boolean;
  requestedAt: string;
  waitingDays: number;
};

/** The client's own view of their payment, coordinates included once sent. */
export type MyPayment = {
  id: string;
  reference: string | null;
  subject: string;
  state: PaymentState;
  currency: string;
  amountDue: string;
  amountReceived: string;
  outstanding: string;
  expiresAt: string | null;
  preferredChannel: PaymentChannel | null;
  channel: PaymentChannel | null;
  coordinates: Record<string, string> | null;
  sentAt: string | null;
  identityStatus: 'none' | 'pending' | 'verified' | 'rejected';
  waitingReason: 'identity' | 'backoffice' | null;
};
