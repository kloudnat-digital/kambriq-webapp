import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  PaymentChannel,
  PaymentState,
  RECORDABLE_CHANNELS,
  SELECTABLE_CHANNELS,
  requiresPaidBy,
} from '@kambriq/common';
import { PROOF_CONTENT_TYPES } from '../payments.service';

/**
 * DTO for back-office receipt submission.
 * Enforces strict validation of all receipt fields at the application boundary
 * before reaching database constraints.
 */

/**
 * Parses monetary amounts as strings to preserve precision.
 * Prevents precision loss that occurs when parsing as JavaScript Numbers.
 * Evaluates to `BigInt` safely over the wire.
 */
const integerAmount = z
  .string()
  .regex(/^-?\d{1,19}$/, 'An amount is an integer in the indivisible unit, sent as a string.')
  .refine((v) => BigInt(v) !== 0n, 'A receipt of zero records nothing.');

export const recordReceiptSchema = z
  .object({
    amount: integerAmount,
    currency: z.string().regex(/^[A-Z]{3}$/, 'An ISO 4217 code, upper case.'),
    /**
     * Narrows the channel enum to the explicitly recordable subset.
     * Rejects historical or invalid channel states (e.g., `INCONNU_HISTORIQUE`).
     */
    channel: z
      .nativeEnum(PaymentChannel)
      .refine(
        (c) => RECORDABLE_CHANNELS.includes(c),
        `A channel must be one of ${RECORDABLE_CHANNELS.join(', ')}.`,
      ),
    /**
     * Represents the actual date of funds arrival, distinct from `recordedAt`.
     * Validates as an ISO string over the wire to avoid startup crashes in
     * `nestjs-zod`'s OpenAPI generation caused by `z.coerce.date()`.
     */
    receivedAt: z
      .string()
      .min(1)
      .refine(
        (v) => !Number.isNaN(Date.parse(v)),
        'An ISO 8601 date, e.g. 2026-09-02T00:00:00.000Z',
      ),
    /** The S3 key from the upload-url route. Required: no proof, no receipt. */
    evidenceUrl: z.string().min(1, 'A receipt requires its proof.'),
    /**
     * Declared depositor name. Strictly required for `DEPO` channels via refinement.
     */
    paidBy: z.string().min(1).max(200).optional(),
    /** Set when this line corrects an earlier one. */
    correctsId: z.string().uuid().optional(),
    note: z.string().max(1000).optional(),
  })
  .refine((d) => !requiresPaidBy(d.channel) || (d.paidBy !== undefined && d.paidBy.trim() !== ''), {
    // A deposit is made at a counter, in cash, often by a relative in Douala
    // or a friend passing through. Without a name the back office holds a slip
    // it cannot match to anything.
    message: "Un depot d'especes doit nommer la personne qui a verse.",
    path: ['paidBy'],
  })
  .refine((d) => d.correctsId === undefined || (d.note !== undefined && d.note.trim() !== ''), {
    // G5, v03 §7: a correction carries its own reason. The service refuses it
    // too; this refuses it a boundary earlier, with a message a person can act on.
    message:
      'Une correction porte son propre motif. Dites ce qui etait faux sur la ligne corrigee.',
    path: ['note'],
  });
export class RecordReceiptDto extends createZodDto(recordReceiptSchema) {}

export const proofUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.enum(PROOF_CONTENT_TYPES),
});
export class ProofUploadUrlDto extends createZodDto(proofUploadUrlSchema) {}

export const validatePaymentSchema = z.object({
  /**
   * Mandatory reason for payment validation to maintain auditability.
   */
  reason: z.string().min(1, 'Validating a payment records why. A blank reason is refused.'),
  /**
   * Required evidence receipt ID validating the payment transition to VALIDE.
   */
  evidenceReceiptId: z.string().uuid('Validating names the encaissement the decision rests on.'),
});
export class ValidatePaymentDto extends createZodDto(validatePaymentSchema) {}

export const transitionPaymentSchema = z.object({
  /**
   * Target state for the transition.
   * Uses `nativeEnum` to ensure contract consistency with the state machine.
   * State machine transition legality is enforced downstream.
   */
  to: z.nativeEnum(PaymentState),
  reason: z.string().min(1, 'A state change records why. A blank reason is refused.'),
  /**
   * Evidence receipt for the transition.
   * Required conditionally by the transition guard for `EVIDENCED_STATES` (e.g., `PARTIELLEMENT_RECU`).
   */
  evidenceReceiptId: z.string().uuid().optional(),
});
export class TransitionPaymentDto extends createZodDto(transitionPaymentSchema) {}

/**
 * The client's declared preference. **Nullable on purpose** - "no preference"
 * is a real answer, and forcing a choice would manufacture one.
 */
export const preferredChannelSchema = z.object({
  preferredChannel: z
    .nativeEnum(PaymentChannel)
    .refine((c) => SELECTABLE_CHANNELS.includes(c), {
      message: `Choose one of ${SELECTABLE_CHANNELS.join(', ')}.`,
    })
    .nullable()
    .optional(),
});
export class PreferredChannelDto extends createZodDto(preferredChannelSchema) {}

/**
 * The back office's decision at send time.
 *
 * `channel` is required and there is no default: v03 asks for the choice to be
 * a decision, and a field that arrives pre-filled with the client's preference
 * would make accepting it the path of least resistance.
 */
export const sendInstructionsSchema = z.object({
  channel: z.nativeEnum(PaymentChannel).refine((c) => SELECTABLE_CHANNELS.includes(c), {
    message: `Choose one of ${SELECTABLE_CHANNELS.join(', ')}.`,
  }),
  reason: z
    .string()
    .min(1, 'Sending coordinates records why this channel. A blank reason is refused.'),
});
export class SendInstructionsDto extends createZodDto(sendInstructionsSchema) {}
