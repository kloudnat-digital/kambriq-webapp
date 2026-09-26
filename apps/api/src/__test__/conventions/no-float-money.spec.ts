import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * No monetary field is a floating-point type. Anywhere, in any of the four
 * schemas.
 *
 * A convention, not a review habit: reviews miss one field once and the field
 * is there for years. `downPaymentAmount Float?` survived every review this
 * repository has had, and the audit found it only by reading the design beside
 * the schema.
 *
 * **Why it matters here specifically.** XAF has no minor unit, so amounts are
 * whole francs and reach large integers directly - a land at 15 000 000 XAF is
 * an ordinary row. `Float` is binary float64: it represents every integer
 * exactly only up to 2^53, it cannot represent 0.1, and money that is summed
 * repeatedly drifts. The design says it in one line - *"un montant, en unite
 * indivisible, avec sa devise explicite"* - and this test is that line made
 * enforceable.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const MODULES = ['core', 'kbs', 'kamnet', 'lands'] as const;

/** Field names that denote money. Matched case-insensitively on the whole name. */
const MONETARY = /(amount|price|montant|total|balance|fee|cost|commission|payout|due|paid|prix)/i;

/**
 * Names that match `MONETARY` but are not money.
 *
 * `pv` and `tpc` are coefficients; `sizeM2`, `latitude` and `longitude` are
 * measurements. They are listed rather than excluded by a cleverer regex,
 * because a cleverer regex is the thing that silently stops matching.
 */
const NOT_MONEY = new Set([
  'pv',
  'tpc',
  'sizeM2',
  'latitude',
  'longitude',
  // A count of questions, not a total of money. Matched by `total`.
  'totalQuestions',
]);

/**
 * Monetary `Float` columns that predate G1 and are NOT converted by it.
 *
 * This list is quarantine, not permission. It is pinned in both directions: a
 * new monetary Float fails the test because it is not here, and converting one
 * of these without removing its line fails the test too, so the list cannot rot
 * into a lie.
 *
 * `Land.totalPrice` and its price history were converted to `BigInt` on 26
 * September; the response envelope turns a BigInt into an exact number (or a
 * string past that range), which is what made the conversion small.
 * `LandReservation.downPaymentAmount` followed on 27 September - still
 * deprecated by G1, still kept, now integer. One remains.
 */
const QUARANTINED: ReadonlyArray<{ module: string; field: string; why: string }> = [
  {
    module: 'kamnet',
    field: 'amount',
    why: 'KamnetCommission.amount - moves with Land.totalPrice, which it is derived from',
  },
];

type Field = { module: string; name: string; type: string; line: number };

/** Every scalar field declaration in a schema, with its declared type. */
const fieldsOf = (module: string): Field[] => {
  const src = readFileSync(join(ROOT, 'prisma', module, 'schema.prisma'), 'utf8');
  return src.split('\n').flatMap((line, i) => {
    // `  name   Type?  // comment` - ignore comments, blocks and attributes.
    // The trailing `(\s|$)` matters: `  amountDue BigInt` ends the line, and a
    // pattern demanding whitespace after the type silently skipped every field
    // that had no attribute after it - which is most of the ones G1 adds.
    const m = /^\s{2}([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z][A-Za-z0-9_]*)(\[\])?\??(\s|$)/.exec(line);
    if (!m || line.trimStart().startsWith('//') || line.trimStart().startsWith('///')) return [];
    return [{ module, name: m[1], type: m[2], line: i + 1 }];
  });
};

const ALL_FIELDS = MODULES.flatMap(fieldsOf);
const FLOATING = new Set(['Float', 'Decimal', 'Double', 'Real']);

const isMonetary = (f: Field) => MONETARY.test(f.name) && !NOT_MONEY.has(f.name);
const quarantined = (f: Field) =>
  QUARANTINED.some((q) => q.module === f.module && q.field === f.name);

describe('money is never a floating-point type', () => {
  it('is reading the schemas at all', () => {
    // A scanner that parses nothing makes every assertion below vacuous.
    expect(ALL_FIELDS.length).toBeGreaterThan(150);
    expect(ALL_FIELDS.filter((f) => f.module === 'lands').length).toBeGreaterThan(40);
    // And it can see the types it is looking for.
    expect(ALL_FIELDS.some((f) => f.type === 'Float')).toBe(true);
    expect(ALL_FIELDS.some((f) => f.type === 'BigInt')).toBe(true);
  });

  it('recognises the fields G1 introduced as monetary', () => {
    // If the name regex stopped matching, the test would pass by finding
    // nothing. Pin the fields it must see.
    const names = ALL_FIELDS.filter(isMonetary).map((f) => f.name);
    expect(names).toContain('amountDue');
    expect(names).toContain('amount');
    expect(names).toContain('totalPrice');
    expect(names).toContain('pricePerM2');
  });

  it('no monetary field is Float, Decimal, Double or Real', () => {
    const offenders = ALL_FIELDS.filter(isMonetary)
      .filter((f) => FLOATING.has(f.type))
      .filter((f) => !quarantined(f))
      .map((f) => `${f.module}/schema.prisma:${f.line} ${f.name} ${f.type}`);

    expect(offenders).toEqual([]);
  });

  it('every monetary field G1 owns is BigInt', () => {
    const g1 = ALL_FIELDS.filter((f) => f.name === 'amountDue' || f.name === 'currency');
    expect(g1.length).toBeGreaterThanOrEqual(3);
    for (const f of g1.filter((x) => x.name === 'amountDue')) {
      expect(f.type).toBe('BigInt');
    }
  });

  it('every amount has a currency beside it', () => {
    // An amount without its currency is a number, not money.
    const src = readFileSync(join(ROOT, 'prisma', 'lands', 'schema.prisma'), 'utf8');
    for (const model of ['model Payment {', 'model PaymentReceipt {']) {
      const body = src.slice(src.indexOf(model), src.indexOf('\n}', src.indexOf(model)));
      expect(body).toMatch(/\bBigInt\b/);
      expect(body).toMatch(/\bcurrency\s+String\b/);
    }
  });

  it('the quarantine list is exact, so it cannot rot into a lie', () => {
    // Every quarantined field must still exist AND still be floating-point.
    // Convert one and forget this list, and this fails - which is the point.
    for (const q of QUARANTINED) {
      const found = ALL_FIELDS.find((f) => f.module === q.module && f.name === q.field);
      expect(found).toBeDefined();
      expect(FLOATING.has(found?.type ?? '')).toBe(true);
    }
    expect(QUARANTINED).toHaveLength(1);
  });
});
