/**
 * The payment state machine of ops_kambriq_paiement-hybride_v01.md.
 *
 * Prisma can hold the nine states; it cannot say which moves between them are
 * legal. That lives here, with the guards, so that the service, the tests and
 * any future caller are all constrained by one table rather than by three
 * copies of a comment.
 */

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
 * The channels, their codes and their labels live in `payment-channels.ts`.
 *
 * Re-exported here so the many call sites that import `PaymentChannel` from the
 * state machine keep working, and so there is one import path for "everything
 * about a payment's shape". `RECORDABLE_CHANNELS` is derived from the registry's
 * `selectable` flag rather than listed a second time.
 */
export { PaymentChannel, RECORDABLE_CHANNELS } from './payment-channels';

/**
 * States from which nothing further is legal.
 *
 * `VALIDE` is terminal too: a payment that turns out to have been wrongly
 * validated is corrected by appending to the ledger, not by moving the state
 * backwards. Nothing is rewritable after the fact.
 */
export const TERMINAL_STATES: ReadonlySet<PaymentState> = new Set([
  PaymentState.VALIDE,
  PaymentState.REJETE,
  PaymentState.EXPIRE,
  PaymentState.ANNULE,
]);

/**
 * The transition table, read straight off the design.
 *
 *   INITIE -> INSTRUCTIONS_ENVOYEES -> ANNONCE_CLIENT -> EN_VERIFICATION
 *     -> PARTIELLEMENT_RECU (loops on itself) -> VALIDE
 *   exits: REJETE, EXPIRE, ANNULE
 *
 * The exits are reachable from every non-terminal state, which is what "sorties"
 * means: a payment can be cancelled or rejected wherever it has got to, and can
 * expire wherever it has stalled.
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
  // Loops on itself: land is paid in instalments, and a system that knows only
  // paid-or-unpaid gets worked around from the first sale - the instalments end
  // up in a notebook, outside the platform.
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
 * Transitions that commit money, or that close a payment by a human decision.
 *
 * `EXPIRE` is deliberately absent. The design asks for exactly one automatic
 * transition - "passe en EXPIRE au terme, avec sa raison" - so the dunning job
 * is allowed to make it, and nothing else. Anyone tightening this guard later
 * should know that omission is deliberate rather than an oversight.
 */
export const COMMITTING_STATES: ReadonlySet<PaymentState> = new Set([
  PaymentState.PARTIELLEMENT_RECU,
  PaymentState.VALIDE,
  PaymentState.REJETE,
  PaymentState.ANNULE,
]);

/**
 * G7 - the states that assert money was seen, and therefore rest on a receipt.
 *
 * v03 section 4: `PARTIELLEMENT_RECU` is "une partie du montant est constatee
 * et prouvee", `VALIDE` is "la totalite est constatee et prouvee". *Prouvee* is
 * a justificatif, and the justificatif hangs off a ledger line. So a transition
 * into either names the `PaymentReceipt` it rests on, and the audit row's
 * `evidenceReceiptId` is the answer to "sur quelle preuve".
 *
 * **Every other state carries NULL, deliberately**, and each for a reason:
 *
 * - `INITIE` - creation; nothing has been paid.
 * - `INSTRUCTIONS_ENVOYEES` - the evidence is what was communicated, and the
 *   row records that in `communicatedDetails` and `channel` instead.
 * - `ANNONCE_CLIENT` - the client's word, which is a claim and not a proof.
 * - `EN_VERIFICATION` - the back office is looking; nothing is established yet.
 * - `REJETE`, `ANNULE` - a decision that money did *not* settle this; its
 *   basis is the reason, written by a named person.
 * - `EXPIRE` - the calendar, with nobody's name on it by design.
 *
 * A receipt may still be *offered* on those steps (`evidenceReceiptId` is
 * optional there), but it is never demanded. Demanding one would make people
 * attach the nearest receipt to satisfy a field, which is how a trail fills up
 * with evidence of nothing.
 */
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
 * Thrown when an act that must carry a person's name does not.
 *
 * G9: creation needs this as much as a transition does. A payment is an
 * obligation, and an obligation that appears with nobody's name on it is the
 * `KCA_CERTIFIED` shape one step earlier than the transition table can see -
 * the guard there only looks at states, and creation has no `from` state to
 * check.
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
 * Throws unless `actorUserId` is a person rather than a marker.
 *
 * One definition of "a named actor", used by creation and by the transition
 * guard. Two copies of this list would agree until somebody added `daemon` to
 * one of them.
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

/**
 * The guard. A barrier, not an assertion.
 *
 * `KCA_CERTIFIED` was granted on an exam score: a business event crossed a
 * boundary that commits, with no human in between, and the symptom was somebody
 * becoming an agent with no certificate. Here the boundary commits **money**.
 *
 * This throws rather than reporting, and it lives in the service path rather
 * than in a test, because an assertion in a test is a report about a run that
 * already happened. A test cannot refuse a write.
 */
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
 * The total received, computed. There is no other way to obtain it.
 *
 * Exported so that the same summation is used by the service and by anything
 * that needs to check it, rather than two implementations that agree until they
 * do not.
 */
export function sumReceipts(receipts: ReadonlyArray<{ amount: bigint }>): bigint {
  return receipts.reduce((total, r) => total + r.amount, 0n);
}
