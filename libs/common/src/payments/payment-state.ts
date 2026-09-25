/** Defines payment states, transitions, and structural validation guards. */

/** Mirrors `PaymentState` in prisma/lands/schema.prisma. */
export enum PaymentState {
  INITIE = 'INITIE',
  INSTRUCTIONS_ENVOYEES = 'INSTRUCTIONS_ENVOYEES',
  ANNONCE_CLIENT = 'ANNONCE_CLIENT',
  EN_VERIFICATION = 'EN_VERIFICATION',
  PARTIELLEMENT_RECU = 'PARTIELLEMENT_RECU',
  VALIDE = 'VALIDE',
  REJETE = 'REJETE',
  EXPIRE = 'EXPIRE',
  ANNULE = 'ANNULE',
}

/**
 * Re-export payment channels to provide a centralized import path for payment-related models.
 */
export { PaymentChannel, RECORDABLE_CHANNELS } from './payment-channels';

/** Terminal payment states. Corrections require appending new ledger entries. */
export const TERMINAL_STATES: ReadonlySet<PaymentState> = new Set([
  PaymentState.VALIDE,
  PaymentState.REJETE,
  PaymentState.EXPIRE,
  PaymentState.ANNULE,
]);

/**
 * Allowed payment state transitions.
 * Exits (REJETE, EXPIRE, ANNULE) are reachable from any non-terminal state.
 * PARTIELLEMENT_RECU can transition to itself for installments.
 */
const EXITS: readonly PaymentState[] = [
  PaymentState.REJETE,
  PaymentState.EXPIRE,
  PaymentState.ANNULE,
];

export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentState, readonly PaymentState[]>> = {
  [PaymentState.INITIE]: [PaymentState.INSTRUCTIONS_ENVOYEES, ...EXITS],
  [PaymentState.INSTRUCTIONS_ENVOYEES]: [PaymentState.ANNONCE_CLIENT, ...EXITS],
  [PaymentState.ANNONCE_CLIENT]: [PaymentState.EN_VERIFICATION, ...EXITS],
  [PaymentState.EN_VERIFICATION]: [PaymentState.PARTIELLEMENT_RECU, ...EXITS],
  // Permits transitions to itself to support installment payments.
  [PaymentState.PARTIELLEMENT_RECU]: [
    PaymentState.PARTIELLEMENT_RECU,
    PaymentState.VALIDE,
    ...EXITS,
  ],
  [PaymentState.VALIDE]: [],
  [PaymentState.REJETE]: [],
  [PaymentState.EXPIRE]: [],
  [PaymentState.ANNULE]: [],
};

/**
 * States that finalize financial commitments or require explicit human intervention.
 * Note: EXPIRE is excluded as it is an automated, time-based transition.
 */
export const COMMITTING_STATES: ReadonlySet<PaymentState> = new Set([
  PaymentState.PARTIELLEMENT_RECU,
  PaymentState.VALIDE,
  PaymentState.REJETE,
  PaymentState.ANNULE,
]);

/** States requiring an explicit evidence receipt to verify the transaction. */
export const EVIDENCED_STATES: ReadonlySet<PaymentState> = new Set([
  PaymentState.PARTIELLEMENT_RECU,
  PaymentState.VALIDE,
]);

export class EvidenceRequiredError extends Error {
  constructor(to: PaymentState) {
    super(
      `Refusing to move a payment to ${to} without the encaissement it rests on. ${to} ` +
        `says money was seen and proved; the audit row must name the receipt that proves it.`,
    );
    this.name = 'EvidenceRequiredError';
  }
}

/**
 * Throws when a state that asserts money was seen is entered with no receipt
 * behind it. Knows nothing about whether the receipt is real or this
 * payment's - that needs the database, and `PaymentsService` checks it.
 */
export function assertTransitionIsEvidenced(
  to: PaymentState,
  evidenceReceiptId: string | null | undefined,
): void {
  if (!EVIDENCED_STATES.has(to)) return;
  if ((evidenceReceiptId ?? '').trim() === '') throw new EvidenceRequiredError(to);
}

/** Actor values that are not a person. Compared case-insensitively, trimmed. */
const SYSTEM_ACTORS: ReadonlySet<string> = new Set([
  'system',
  'bootstrap',
  'job',
  'worker',
  'cron',
  'scheduler',
  'processor',
  'automatic',
  'auto',
]);

/**
 * Thrown when a business event requiring a named human actor lacks one.
 */
export class UnnamedActorError extends Error {
  constructor(act: string, actor: string) {
    super(
      `Refusing to ${act} on behalf of "${actor}". This act is performed by a ` +
        `named person, and "${actor}" is not one. A business event must never ` +
        `cross this boundary by itself.`,
    );
    this.name = 'UnnamedActorError';
  }
}

/**
 * Asserts that the actor ID represents a named user rather than a system account.
 */
export function assertActorIsNamed(actorUserId: string | null | undefined, act: string): void {
  const actor = (actorUserId ?? '').trim();
  if (actor === '' || SYSTEM_ACTORS.has(actor.toLowerCase())) {
    throw new UnnamedActorError(act, actor || '(none)');
  }
}

export class IllegalPaymentTransitionError extends Error {
  constructor(from: PaymentState, to: PaymentState) {
    super(
      `Illegal payment transition ${from} -> ${to}. Legal from ${from}: ` +
        `${PAYMENT_TRANSITIONS[from].join(', ') || '(none - terminal)'}.`,
    );
    this.name = 'IllegalPaymentTransitionError';
  }
}

export class AutomaticTransitionForbiddenError extends Error {
  constructor(to: PaymentState, actor: string) {
    super(
      `Refusing to move a payment to ${to} on behalf of "${actor}". A transition ` +
        `that commits money is an explicit act by a named person, with a reason. ` +
        `A business event must never cross this boundary by itself.`,
    );
    this.name = 'AutomaticTransitionForbiddenError';
  }
}

/** Throws unless `to` is reachable from `from`. */
export function assertTransitionAllowed(from: PaymentState, to: PaymentState): void {
  if (!PAYMENT_TRANSITIONS[from].includes(to)) {
    throw new IllegalPaymentTransitionError(from, to);
  }
}

/** Requires explicit, reasoned actions by named human actors to enter committing states. */
export function assertTransitionIsDeliberate(
  to: PaymentState,
  actorUserId: string | null | undefined,
  reason: string | null | undefined,
): void {
  if (!COMMITTING_STATES.has(to)) return;

  const actor = (actorUserId ?? '').trim();
  if (actor === '' || SYSTEM_ACTORS.has(actor.toLowerCase())) {
    // Same list as `assertActorIsNamed`, different error: this one names the
    // state being entered, which is the fact a reader of the audit trail needs.
    throw new AutomaticTransitionForbiddenError(to, actor || '(none)');
  }
  if ((reason ?? '').trim() === '') {
    throw new AutomaticTransitionForbiddenError(to, `${actor} (no reason given)`);
  }
}

/**
 * Calculates the total monetary amount from a collection of receipts.
 */
export function sumReceipts(receipts: ReadonlyArray<{ amount: bigint }>): bigint {
  return receipts.reduce((total, r) => total + r.amount, 0n);
}
