/**
 * G2 - the payment reference.
 *
 * Specification: `ops_kambriq_paiement-hybride_v01.md`, "La reference de
 * paiement". G1 defined the column, its uniqueness constraint and its format
 * constraint; this fills it.
 *
 * ```
 * KBQ-2609-7F3K2-B
 *      |    |     +-- check character
 *      |    +-------- 5 characters, alphabet excluding O/0, I/1/L, S/5
 *      +------------- year and month
 * ```
 *
 * **Every decision here follows from one fact:** this string is dictated over
 * the telephone, copied onto a transfer slip by hand, read aloud by a notary and
 * retyped by the back office. It is the only thing tying money that moved
 * outside the platform to a payment inside it.
 */

/**
 * The confusable pairs, as data. Removed from the alphabet below.
 *
 * `O`/`0` and `I`/`1`/`L` collide in writing; `S`/`5` collides in both writing
 * and speech. Ten minutes of implementation against hours of support.
 */
const CONFUSABLE = 'O0IL1S5';

const BASE36 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * 29 characters. **Defined once and derived**, so there is no second spelling to
 * drift from this one.
 *
 * One duplicate is unavoidable: G1's `CHECK` constraint spells the class in SQL,
 * which cannot import this. `payment-reference.spec.ts` asserts the two are
 * character-for-character identical, so the duplication is pinned rather than
 * trusted.
 */
export const REFERENCE_ALPHABET = [...BASE36].filter((c) => !CONFUSABLE.includes(c)).join('');

export const REFERENCE_PREFIX = 'KBQ';
export const REFERENCE_BODY_LENGTH = 5;

/** 29^5 = 20 511 149 distinct bodies per month. */
export const REFERENCE_BODY_SPACE = REFERENCE_ALPHABET.length ** REFERENCE_BODY_LENGTH;

/**
 * Weights for the check character, one per covered character: four for `YYMM`,
 * five for the body. Distinct, and none of them a multiple of 29.
 *
 * **Why a weighted sum modulo 29 rather than Luhn.** 29 is prime, and that is
 * the whole argument:
 *
 * - **a single wrong character** shifts the sum by `w_i * d`, where `d` is the
 *   change in that character's value. `w_i` is between 2 and 10 and `d` is
 *   between -28 and 28, neither ever a multiple of a prime larger than both, so
 *   the product is never 0 mod 29. **Every single-character error moves the
 *   check character. 100%, by construction rather than by measurement.**
 * - **two adjacent characters transposed** shifts the sum by
 *   `(w_i - w_{i+1}) * (v_i - v_{i+1})`. Consecutive weights differ by exactly
 *   1, so the first factor is never 0 mod 29, and the second is 0 only when the
 *   two characters are **the same character** - in which case transposing them
 *   produces the identical string and there is no error to detect.
 *
 * Luhn mod N gets the first property and **not** the second: it misses specific
 * adjacent pairs. A checksum that catches neither class is decoration; one that
 * catches only the first is half of what this workflow needs, because a person
 * reading a reference aloud transposes.
 */
const CHECK_WEIGHTS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const MODULUS = REFERENCE_ALPHABET.length;

/**
 * A bijection over the body space, so consecutive sequence values do not produce
 * consecutive-looking references.
 *
 * `MULTIPLIER` is coprime to 29^5 - it is not a multiple of 29 - which makes
 * `n -> (n * MULTIPLIER + OFFSET) mod 29^5` a permutation. **A permutation
 * cannot collide**, so this scrambles the appearance without weakening the
 * guarantee the sequence provides.
 *
 * It is not a secret and is not meant to be: the reference is an identifier, not
 * a credential. This exists so that references do not read as a running count of
 * how much business KAMBRIQ did this month.
 */
const MULTIPLIER = 7_777_763;
const OFFSET = 1_234_577;

const indexOf = (c: string): number => REFERENCE_ALPHABET.indexOf(c);

/** `YYMM` for a date, in the platform's own terms. */
export const referencePeriod = (at: Date): string => {
  const yy = String(at.getUTCFullYear() % 100).padStart(2, '0');
  const mm = String(at.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
};

/** Base-29 encoding of a scrambled counter into exactly five characters. */
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
 * The check character for a period and body.
 *
 * `YYMM` is covered as well as the body: a miscopied month is as damaging as a
 * miscopied body character, and it is the part a person is most likely to
 * "correct" from memory.
 */
export const checkCharacter = (period: string, body: string): string => {
  const values = [...period].map((d) => Number(d)).concat([...body].map(indexOf));

  if (values.length !== CHECK_WEIGHTS.length || values.some((v) => !Number.isInteger(v) || v < 0)) {
    throw new Error(`Cannot compute a check character for "${period}-${body}"`);
  }

  const sum = values.reduce((acc, v, i) => acc + v * CHECK_WEIGHTS[i], 0);
  return REFERENCE_ALPHABET[sum % MODULUS];
};

/** `KBQ-YYMM-BBBBB-C`, the form a person sees. */
export const formatReference = (period: string, body: string): string =>
  `${REFERENCE_PREFIX}-${period}-${body}-${checkCharacter(period, body)}`;

/** Builds the reference for a counter value, at a moment. */
export const buildReference = (counter: number, at: Date): string =>
  formatReference(referencePeriod(at), encodeBody(counter));

// ---------------------------------------------------------------------------
// Validation - a separate function, used when a person types a reference in
// ---------------------------------------------------------------------------

export type ReferenceRejection = 'empty' | 'confusable-character' | 'malformed' | 'check-character';

export type ReferenceValidation =
  | { valid: true; reference: string; period: string; body: string }
  | { valid: false; reason: ReferenceRejection; detail: string };

/**
 * Normalises what a person typed, without changing what they meant.
 *
 * Case is folded and spaces and hyphens are dropped, because those are
 * presentation. **Confusable characters are not mapped**, they are rejected:
 * `O` is not in the alphabet, so a `0` in the body is unambiguous evidence of a
 * typo. Silently reading it as `O` would turn a mistyped reference into a
 * *different valid* reference and attach somebody's money to somebody else's
 * payment - which is the exact failure the check character exists to prevent,
 * reintroduced by the code meant to be helpful.
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

  // Only the body and the check character are drawn from the restricted
  // alphabet. `YYMM` is ordinary digits, so a `0` there is a month, not a typo -
  // 2026-01 is `2601`. Rejecting a zero everywhere would refuse January.
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
