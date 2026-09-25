/**
 * Generates and validates transcription-safe payment references.
 * Format: KBQ-YYMM-XXXXX-C (YYMM: Period, XXXXX: Base-29 body, C: Modulo-29 check character)
 */

/** Confusable characters excluded from the alphabet. */
const CONFUSABLE = 'O0IL1S5';

const BASE36 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * The 29-character alphabet used for payment references, derived by excluding confusable characters.
 */
export const REFERENCE_ALPHABET = [...BASE36].filter((c) => !CONFUSABLE.includes(c)).join('');

export const REFERENCE_PREFIX = 'KBQ';
export const REFERENCE_BODY_LENGTH = 5;

/** Number of distinct reference bodies possible per month (29^5). */
export const REFERENCE_BODY_SPACE = REFERENCE_ALPHABET.length ** REFERENCE_BODY_LENGTH;

/** Modulo-29 check weights guaranteeing detection of single-character and adjacent transposition errors. */
const CHECK_WEIGHTS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const MODULUS = REFERENCE_ALPHABET.length;

/** LCG parameters for sequence obfuscation without collisions. */
const MULTIPLIER = 7_777_763;
const OFFSET = 1_234_577;

const indexOf = (c: string): number => REFERENCE_ALPHABET.indexOf(c);

/** Generates the YYMM period string from a given date. */
export const referencePeriod = (at: Date): string => {
  const yy = String(at.getUTCFullYear() % 100).padStart(2, '0');
  const mm = String(at.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
};

/** Encodes an integer counter into a 5-character base-29 string with sequence obfuscation. */
export const encodeBody = (counter: number): string => {
  if (!Number.isInteger(counter) || counter < 0) {
    throw new Error(`Reference counter must be a non-negative integer, received ${counter}`);
  }
  let n = (counter * MULTIPLIER + OFFSET) % REFERENCE_BODY_SPACE;
  let body = '';
  for (let i = 0; i < REFERENCE_BODY_LENGTH; i++) {
    body = REFERENCE_ALPHABET[n % MODULUS] + body;
    n = Math.floor(n / MODULUS);
  }
  return body;
};

/**
 * Calculates the check character for a given period and body string.
 */
export const checkCharacter = (period: string, body: string): string => {
  const values = [...period].map((d) => Number(d)).concat([...body].map(indexOf));

  if (values.length !== CHECK_WEIGHTS.length || values.some((v) => !Number.isInteger(v) || v < 0)) {
    throw new Error(`Cannot compute a check character for "${period}-${body}"`);
  }

  const sum = values.reduce((acc, v, i) => acc + v * CHECK_WEIGHTS[i], 0);
  return REFERENCE_ALPHABET[sum % MODULUS];
};

/** Formats the period and body into the standard presentation format. */
export const formatReference = (period: string, body: string): string =>
  `${REFERENCE_PREFIX}-${period}-${body}-${checkCharacter(period, body)}`;

/** Builds the reference for a counter value, at a moment. */
export const buildReference = (counter: number, at: Date): string =>
  formatReference(referencePeriod(at), encodeBody(counter));

// ---------------------------------------------------------------------------
// Validation Utilities
// ---------------------------------------------------------------------------

export type ReferenceRejection = 'empty' | 'confusable-character' | 'malformed' | 'check-character';

export type ReferenceValidation =
  | { valid: true; reference: string; period: string; body: string }
  | { valid: false; reason: ReferenceRejection; detail: string };

/**
 * Normalizes a reference string by converting to uppercase and removing whitespace and hyphens.
 * Note: Does not substitute confusable characters; they are explicitly rejected during validation.
 */
export const normalizeReference = (input: string): string =>
  input.toUpperCase().replace(/[\s-]/g, '');

const STRUCTURE = /^KBQ([0-9]{4})([A-Z0-9]{5})([A-Z0-9])$/;

export const validateReference = (input: string): ReferenceValidation => {
  if (!input?.trim()) {
    return { valid: false, reason: 'empty', detail: 'No reference given.' };
  }

  const normalized = normalizeReference(input);
  const m = STRUCTURE.exec(normalized);
  if (!m) {
    return {
      valid: false,
      reason: 'malformed',
      detail: `"${input}" is not KBQ-YYMM-XXXXX-C once spaces and hyphens are removed.`,
    };
  }

  const [, period, body, given] = m;

  // YYMM uses standard digits; restricted alphabet applies only to body and check character.
  const offending = [...body, given].filter((c) => !REFERENCE_ALPHABET.includes(c));
  if (offending.length > 0) {
    return {
      valid: false,
      reason: 'confusable-character',
      detail:
        `"${input}" contains ${[...new Set(offending)].join(', ')}, which the reference ` +
        `alphabet excludes because they are misread. Not corrected: a guess here would ` +
        `produce a different, valid reference.`,
    };
  }

  const expected = checkCharacter(period, body);
  if (given !== expected) {
    return {
      valid: false,
      reason: 'check-character',
      detail: `"${input}" fails its check character. It has been mistyped or miscopied.`,
    };
  }

  return { valid: true, reference: formatReference(period, body), period, body };
};
