/** Represents back-office payment shapes as returned by the API. */

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
 * Monetary amounts are strictly represented as strings to prevent precision loss.
 * These values should not be parsed into JavaScript numbers for client-side arithmetic.
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
  /** The client's preferred payment channel. */
  preferredChannel: PaymentChannel | null;
  /** The payment channel selected by the back office. Null until finalized. */
  channel: PaymentChannel | null;
  clientUserId: string | null;
  identityStatus: 'none' | 'pending' | 'verified' | 'rejected';
  receipts: PaymentReceipt[];
  transitions: PaymentTransition[];
}

/** Represents a single row in the back-office payment request queue. */
export type PaymentRequestRow = {
  id: string;
  reference: string | null;
  clientName: string | null;
  clientUserId: string | null;
  subject: string | null;
  currency: string;
  amountDue: string;
  /** The client's preferred payment channel. */
  preferredChannel: PaymentChannel | null;
  identityStatus: 'none' | 'pending' | 'verified' | 'rejected';
  /** Indicates if the payment request would currently be blocked due to identity verification status. */
  blockedByIdentity: boolean;
  requestedAt: string;
  waitingDays: number;
};

/** The client-facing representation of a payment, including coordinates once sent. */
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
