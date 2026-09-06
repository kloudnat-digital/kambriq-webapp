import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaymentChannel, PaymentState, RECORDABLE_CHANNELS } from '@kambriq/common';
import { PROOF_CONTENT_TYPES } from '../payments.service';

/**
 * G4 - what the back office sends.
 *
 * Every field a receipt carries is required here. The database CHECK is the
 * backstop; a request that reaches it has already passed a boundary that should
 * have refused it.
 */

/**
 * Amounts cross the wire as strings.
 *
 * `BigInt` does not survive `JSON.stringify`, and a monetary amount parsed as a
 * JavaScript number is the `Float` defect G1 removed from the schema,
 * reintroduced at the edge. A digit string is parsed to `BigInt`, never to
 * `Number`.
 */
const integerAmount = z
  .string()
  .regex(/^-?\d{1,19}$/, 'An amount is an integer in the indivisible unit, sent as a string.')
  .refine((v) => BigInt(v) !== 0n, 'A receipt of zero records nothing.');

export const recordReceiptSchema = z.object({
  amount: integerAmount,
  currency: z.string().regex(/^[A-Z]{3}$/, 'An ISO 4217 code, upper case.'),
  /**
   * Derived from the enum, not spelled again, and narrowed to the recordable
   * subset. `INCONNU_HISTORIQUE` belongs to the rows G1 backfilled and is
   * refused here as well as in the service - a new receipt may not claim it has
   * no channel because it never had one.
   */
  channel: z
    .nativeEnum(PaymentChannel)
    .refine(
      (c) => RECORDABLE_CHANNELS.includes(c),
      `A channel must be one of ${RECORDABLE_CHANNELS.join(', ')}.`,
    ),
  /**
   * The real date the money arrived, which is **not** when somebody typed it
   * in. `recordedAt` is set by the server and is a different fact.
   *
   * An ISO string on the wire, converted to a `Date` in the controller.
   * `z.coerce.date()` reads better and **crashes the application at boot**:
   * `nestjs-zod` renders every DTO into an OpenAPI schema at startup and zod's
   * `dateProcessor` throws on a coerced date. Nothing in the type checker or
   * the unit tests sees that - only starting the process does.
   */
  receivedAt: z
    .string()
    .min(1)
    .refine((v) => !Number.isNaN(Date.parse(v)), 'An ISO 8601 date, e.g. 2026-09-02T00:00:00.000Z'),
  /** The S3 key from the upload-url route. Required: no proof, no receipt. */
  evidenceUrl: z.string().min(1, 'A receipt requires its proof.'),
  /** Set when this line corrects an earlier one. */
  correctsId: z.string().uuid().optional(),
  note: z.string().max(1000).optional(),
});
export class RecordReceiptDto extends createZodDto(recordReceiptSchema) {}

export const proofUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.enum(PROOF_CONTENT_TYPES),
});
export class ProofUploadUrlDto extends createZodDto(proofUploadUrlSchema) {}

export const validatePaymentSchema = z.object({
  /**
   * Required, and not a formality. `assertTransitionIsDeliberate` refuses a
   * committing transition without one; this refuses it a boundary earlier, with
   * a message a person can act on.
   */
  reason: z.string().min(1, 'Validating a payment records why. A blank reason is refused.'),
  evidenceReceiptId: z.string().uuid().optional(),
});
export class ValidatePaymentDto extends createZodDto(validatePaymentSchema) {}

export const transitionPaymentSchema = z.object({
  /**
   * The next state. `nativeEnum` rather than a hand-written union, so the wire
   * contract and the state machine cannot drift apart. Whether this particular
   * step is legal from the current state is the transition table's job, not
   * validation's - it depends on a row nobody has read yet.
   */
  to: z.nativeEnum(PaymentState),
  reason: z.string().min(1, 'A state change records why. A blank reason is refused.'),
});
export class TransitionPaymentDto extends createZodDto(transitionPaymentSchema) {}
