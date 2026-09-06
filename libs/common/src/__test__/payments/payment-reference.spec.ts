import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildReference,
  checkCharacter,
  encodeBody,
  normalizeReference,
  REFERENCE_ALPHABET,
  REFERENCE_BODY_LENGTH,
  REFERENCE_BODY_SPACE,
  referencePeriod,
  validateReference,
} from '../../index';

/**
 * G2 - the payment reference.
 *
 * This string is dictated over the telephone, copied onto a transfer slip by
 * hand, read aloud by a notary and retyped by the back office. The tests below
 * are about those four acts and nothing else.
 */
const SAMPLE = 20_000;
const AT = new Date('2026-09-06T12:00:00Z');

/** Deterministic pseudo-random, so a failure is reproducible from its seed. */
const rng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 0x1_0000_0000;
  };
};

describe('the alphabet is defined once and derived', () => {
  it('excludes exactly the confusable characters, and nothing else', () => {
    expect(REFERENCE_ALPHABET).toHaveLength(29);
    for (const c of 'O0IL1S5') expect(REFERENCE_ALPHABET).not.toContain(c);
    // And has not quietly lost anything else along the way.
    for (const c of 'ABCDEFGHJKMNPQRTUVWXYZ2346789') expect(REFERENCE_ALPHABET).toContain(c);
    expect(new Set(REFERENCE_ALPHABET).size).toBe(29);
  });

  it('matches the SQL CHECK constraint character-for-character', () => {
    /**
     * The one duplicate that could not be removed: G1's `CHECK` spells the class
     * in SQL, which cannot import TypeScript. So the duplication is pinned
     * instead of trusted - drift the two apart and this fails.
     */
    const migration = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        '..',
        'prisma',
        'lands',
        'migrations',
        '20260906190000_g1_payment_model',
        'migration.sql',
      ),
      'utf8',
    );
    const inSql = /reference"\s*~\s*'\^KBQ-\[0-9\]\{4\}-\[([A-Z0-9]+)\]/.exec(migration)?.[1];

    expect(inSql).toBeDefined();
    expect(inSql).toBe(REFERENCE_ALPHABET);
  });
});

describe('(a) every generated reference validates, over a real sample', () => {
  const references = Array.from({ length: SAMPLE }, (_, i) => buildReference(i, AT));

  it(`generated ${SAMPLE} references`, () => {
    // A sweep of three proves nothing; a sweep of zero proves less.
    expect(references).toHaveLength(SAMPLE);
    expect(new Set(references).size).toBe(SAMPLE);
  });

  it('all of them validate', () => {
    const bad = references.filter((r) => !validateReference(r).valid);
    expect(bad).toEqual([]);
  });

  it('none contains an excluded character in its body or check position', () => {
    const offenders = references.filter((r) => {
      const [, , body, check] = r.split('-');
      return [...body, check].some((c) => !REFERENCE_ALPHABET.includes(c));
    });
    expect(offenders).toEqual([]);
  });

  it('all are the shape a person is asked to read', () => {
    for (const r of references.slice(0, 200)) {
      expect(r).toMatch(/^KBQ-\d{4}-.{5}-.$/);
      expect(r.split('-')[2]).toHaveLength(REFERENCE_BODY_LENGTH);
    }
  });

  it('the body encoding is a bijection, so it cannot collide with itself', () => {
    // Sampling the space rather than exhausting 20.5M: a bijection that repeats
    // anywhere repeats somewhere findable.
    const bodies = new Set(Array.from({ length: SAMPLE }, (_, i) => encodeBody(i)));
    expect(bodies.size).toBe(SAMPLE);
    expect(REFERENCE_BODY_SPACE).toBe(29 ** 5);
  });

  it('consecutive counters do not produce consecutive-looking references', () => {
    // Not a security property - references are identifiers, not credentials.
    // It stops a reference reading as a running count of the month's business.
    const a = encodeBody(1);
    const b = encodeBody(2);
    expect(a.slice(0, 3)).not.toBe(b.slice(0, 3));
  });
});

describe('(b) corruption is rejected', () => {
  const references = Array.from({ length: 2_000 }, (_, i) => buildReference(i * 7 + 3, AT));

  it('a single wrong character is always caught', () => {
    const random = rng(20260906);
    let tested = 0;
    let caught = 0;

    for (const ref of references) {
      const [, period, body, check] = ref.split('-');
      const flat = period + body + check;

      for (let pos = 0; pos < flat.length; pos++) {
        const original = flat[pos];
        // Replace with a different character from the same value space, so the
        // corruption stays structurally legal and only the checksum can catch
        // it. A corruption the format rejects proves the format, not the check.
        const pool = pos < 4 ? '0123456789' : REFERENCE_ALPHABET;
        const candidates = [...pool].filter((c) => c !== original);
        const replacement = candidates[Math.floor(random() * candidates.length)];

        const mutatedFlat = flat.slice(0, pos) + replacement + flat.slice(pos + 1);
        const mutated = `KBQ-${mutatedFlat.slice(0, 4)}-${mutatedFlat.slice(4, 9)}-${mutatedFlat.slice(9)}`;

        tested++;
        if (!validateReference(mutated).valid) caught++;
      }
    }

    // 2 000 references x 10 positions.
    expect(tested).toBe(20_000);
    expect(caught).toBe(tested);
    // Stated as a rate so the PR can quote it.
    expect((caught / tested) * 100).toBe(100);
  });

  it('two adjacent characters transposed is always caught WITHIN a segment', () => {
    /**
     * Measured in three classes, not one, because they are not the same claim.
     *
     * Within `YYMM` both characters are digits, and within the body both are
     * alphabet indices - one value space each, so the proof holds and detection
     * is total. **Across the hyphen it is not**, and the reason is exact: the
     * same character has two values depending on which side it sits. `'2'` is
     * worth 2 in `YYMM` and 22 in the body, so a swap changes both values in a
     * way the weighting was never going to cancel reliably.
     *
     * Reported rather than hidden, and asserted separately so a regression in
     * the part that IS guaranteed cannot hide behind an average.
     */
    const counts = {
      yymm: { tested: 0, caught: 0 },
      body: { tested: 0, caught: 0 },
      cross: { tested: 0, caught: 0 },
    };
    let identical = 0;

    for (const ref of references) {
      const [, period, body, check] = ref.split('-');
      const flat = period + body + check;

      for (let pos = 0; pos < flat.length - 1; pos++) {
        if (flat[pos] === flat[pos + 1]) {
          // Transposing a character with itself produces the same string. There
          // is no error to detect, and counting it as a miss would understate
          // the algorithm.
          identical++;
          continue;
        }
        const swapped = flat.slice(0, pos) + flat[pos + 1] + flat[pos] + flat.slice(pos + 2);
        const mutated = `KBQ-${swapped.slice(0, 4)}-${swapped.slice(4, 9)}-${swapped.slice(9)}`;

        const cls = pos < 3 ? 'yymm' : pos === 3 ? 'cross' : 'body';
        counts[cls].tested++;
        if (!validateReference(mutated).valid) counts[cls].caught++;
      }
    }

    // The two classes a person actually produces: total.
    expect(counts.yymm.tested).toBeGreaterThan(5_000);
    expect(counts.yymm.caught).toBe(counts.yymm.tested);
    expect(counts.body.tested).toBeGreaterThan(8_000);
    expect(counts.body.caught).toBe(counts.body.tested);

    // The boundary: partial, pinned to the measured rate so an accidental
    // regression shows up rather than passing under a loose bound.
    expect(counts.cross.tested).toBeGreaterThan(1_500);
    const crossRate = (counts.cross.caught / counts.cross.tested) * 100;
    expect(crossRate).toBeGreaterThan(95);
    expect(crossRate).toBeLessThan(100);

    expect(identical).toBeGreaterThan(0);
  });

  it('a swap across the hyphen is mostly caught by the format, not the checksum', () => {
    // Why the residual is not a practical hole: 22 of the 29 alphabet
    // characters are letters, and a letter moved into a YYMM slot is refused by
    // the structure before the check character is consulted. The undetected
    // remainder needs both swapped characters to be digits AND the value shift
    // to cancel mod 29 - and it needs a person to transpose across a hyphen,
    // which is the one place the eye anchors.
    const [, period, body, check] = buildReference(11, AT).split('-');
    const flat = period + body + check;
    const swapped = flat.slice(0, 3) + flat[4] + flat[3] + flat.slice(5);
    const mutated = `KBQ-${swapped.slice(0, 4)}-${swapped.slice(4, 9)}-${swapped.slice(9)}`;

    const result = validateReference(mutated);
    if (!result.valid) expect(['malformed', 'check-character']).toContain(result.reason);
  });
});

describe('validation normalises presentation and refuses guesses', () => {
  const ref = buildReference(4242, AT);

  it.each([
    ['as issued', (r: string) => r],
    ['lower case', (r: string) => r.toLowerCase()],
    ['no hyphens', (r: string) => r.replace(/-/g, '')],
    ['spaces instead of hyphens', (r: string) => r.replace(/-/g, ' ')],
    ['ragged spacing', (r: string) => ` ${r.replace(/-/g, '  ')} `],
  ])('accepts it %s', (_name, transform) => {
    const result = validateReference(transform(ref));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.reference).toBe(ref);
  });

  it('rejects a zero typed where an O was meant, rather than correcting it', () => {
    /**
     * The important one. `O` is not in the alphabet, so a `0` in the body is
     * unambiguous evidence of a typo. Reading it as `O` would turn a mistyped
     * reference into a **different valid** reference, and attach one person's
     * money to another person's payment - the exact failure the check character
     * exists to prevent, reintroduced by the code trying to be helpful.
     */
    const [, period, body, check] = ref.split('-');
    const withZero = `KBQ-${period}-0${body.slice(1)}-${check}`;

    const result = validateReference(withZero);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('confusable-character');
      expect(result.detail).toContain('0');
    }
  });

  it.each(['I', 'L', '1', 'S', '5', 'O', '0'])(
    'rejects %s in the body instead of mapping it',
    (c) => {
      const [, period, body] = ref.split('-');
      const result = validateReference(`KBQ-${period}-${c}${body.slice(1)}-X`);
      expect(result.valid).toBe(false);
    },
  );

  it('accepts a zero in YYMM, because January is 2601', () => {
    // Rejecting the confusables everywhere would refuse every January, October,
    // November and December. The restriction is positional.
    const january = buildReference(99, new Date('2026-01-15T00:00:00Z'));
    expect(january).toContain('-2601-');
    expect(validateReference(january).valid).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['not a reference', 'malformed'],
    ['KBQ-2609-7F3K2', 'malformed'],
    ['ABC-2609-7F3K2-B', 'malformed'],
  ])('rejects %p as %s', (input, reason) => {
    const result = validateReference(input);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe(reason);
  });

  it('says why it refused, because the back office has to tell the caller', () => {
    const [, period, body] = ref.split('-');
    const wrongCheck = REFERENCE_ALPHABET[(REFERENCE_ALPHABET.indexOf(ref.slice(-1)) + 1) % 29];
    const result = validateReference(`KBQ-${period}-${body}-${wrongCheck}`);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('check-character');
      expect(result.detail).toMatch(/mistyped or miscopied/);
    }
  });
});

describe('the period', () => {
  it('is the year and month, in UTC', () => {
    expect(referencePeriod(new Date('2026-09-06T23:59:59Z'))).toBe('2609');
    expect(referencePeriod(new Date('2026-01-01T00:00:00Z'))).toBe('2601');
    expect(referencePeriod(new Date('2030-12-31T00:00:00Z'))).toBe('3012');
  });

  it('is covered by the check character, so a miscopied month is caught', () => {
    const a = checkCharacter('2609', 'ABCDE');
    const b = checkCharacter('2610', 'ABCDE');
    expect(a).not.toBe(b);
  });

  it('normalisation does not alter what was meant', () => {
    expect(normalizeReference(' kbq-2609-7f3k2-b ')).toBe('KBQ26097F3K2B');
  });
});
