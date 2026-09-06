import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { formatHumanDate, formatHumanDateTime, formatMoney, ISO_DATE_PATTERN } from '../../index';

/**
 * G4 (e) - the two display rules, both from defects that reached a real inbox.
 *
 * `G3` sent a client **"750 000 FCFA XAF"**, the currency twice, because
 * `formatXAF` appends "FCFA" itself and was composed with the payment's own
 * currency. And it sent the deadline as **"2026-10-06"**.
 *
 * Neither was visible in the code and both passed every test that existed. So
 * these are not style rules: they are the two shapes that have actually escaped.
 */
describe('(e1) an amount carries its currency exactly once', () => {
  it.each([
    [750_000n, 'XAF', '750 000 XAF'],
    [0n, 'XAF', '0 XAF'],
    [-250_000n, 'XAF', '-250 000 XAF'],
    [15_000_000n, 'EUR', '15 000 000 EUR'],
  ])('formats %s %s', (amount, currency, expected) => {
    // Normalised: Intl uses U+202F, a narrow no-break space, so an assertion
    // typed with an ordinary space fails while showing identical-looking
    // strings.
    expect(formatMoney(amount, currency).replace(/\s/g, ' ')).toBe(expected);
  });

  it.each(['XAF', 'EUR', 'USD'])('names %s once and only once', (currency) => {
    const rendered = formatMoney(1_234_567n, currency);
    expect(rendered.match(new RegExp(currency, 'g'))).toHaveLength(1);
  });

  it('never emits a hardcoded currency symbol beside the code', () => {
    // The exact defect: "750 000 FCFA XAF".
    const rendered = formatMoney(750_000n, 'XAF');
    expect(rendered).not.toContain('FCFA');
    expect(rendered).not.toMatch(/FCFA|CFA|€|\$/);
  });

  it('is exact at magnitudes a float would round', () => {
    // 9 007 199 254 740 993 is the first integer float64 cannot represent. The
    // first version of formatMoney called Number() and rendered ...992 - the
    // Float defect G1 removed from the schema, reintroduced in the formatter
    // written to prevent it.
    expect(formatMoney(9_007_199_254_740_993n, 'XAF').replace(/\s/g, ' ')).toBe(
      '9 007 199 254 740 993 XAF',
    );
    // No companion assertion on Number(): the literal 9_007_199_254_740_993
    // is itself rounded at parse time, so both sides of such a comparison are
    // the same value and it would prove nothing.
  });
});

describe('(e2) no date is shown to a person in ISO form', () => {
  it.each([
    [new Date('2026-10-06T00:00:00Z'), '6 octobre 2026'],
    [new Date('2026-01-31T00:00:00Z'), '31 janvier 2026'],
  ])('renders %s in long form', (at, expected) => {
    expect(formatHumanDate(at)).toBe(expected);
  });

  it.each([formatHumanDate(new Date()), formatHumanDateTime(new Date())])(
    'produces nothing matching an ISO date: %s',
    (rendered) => {
      expect(rendered).not.toMatch(ISO_DATE_PATTERN);
    },
  );

  it('renders a missing date as a dash, not as an empty string', () => {
    // A blank in a date position reads as a rendering fault; a dash reads as
    // "none".
    expect(formatHumanDate(null)).toBe('—');
    expect(formatHumanDate(undefined)).toBe('—');
    expect(formatHumanDate('not a date')).toBe('—');
  });

  it('keeps the time when ordering matters, still not in ISO', () => {
    const rendered = formatHumanDateTime(new Date('2026-10-06T14:30:00Z'));
    expect(rendered).toMatch(/octobre/);
    expect(rendered).not.toMatch(ISO_DATE_PATTERN);
  });
});

describe('(e) the rules are enforced across the back-office surface, not only here', () => {
  const ROOT = join(__dirname, '..', '..', '..', '..', '..');

  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules' || e === '.next') continue;
      const f = join(dir, e);
      if (statSync(f).isDirectory()) out.push(...walk(f));
      else if (['.ts', '.tsx'].includes(extname(e))) out.push(f);
    }
    return out;
  };

  /** The web surface G4 owns. */
  const SURFACE = join(ROOT, 'apps', 'web', 'src', 'components', 'payments-admin');

  /**
   * Comments are stripped before scanning.
   *
   * The first version of this sweep flagged `payment-money.tsx` - the file that
   * exists to centralise formatting - because its doc comment **names** the APIs
   * it bans. A scanner that cannot tell prose from code reports the fix as the
   * defect. `role-code-literals.spec.ts` solved this already; the same
   * `stripComments` is used here.
   */
  const stripComments = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  const scan = (pattern: RegExp): string[] =>
    walk(SURFACE)
      .filter((f) => pattern.test(stripComments(readFileSync(f, 'utf8'))))
      .map((f) => relative(ROOT, f));

  it('is reading the screen it thinks it is', () => {
    expect(walk(SURFACE).length).toBeGreaterThan(2);
    // And the scanner can see code, not only whitespace.
    expect(scan(/formatMoney/)).not.toEqual([]);
  });

  it('the screen formats money through formatMoney and nothing else', () => {
    // `formatXAF` appends its own currency and is what produced
    // "750 000 FCFA XAF". `Intl` and `toLocaleString` are the other two ways to
    // format an amount, and both would bypass the single formatter.
    expect(scan(/formatXAF|toLocaleString\(|Intl\.NumberFormat/)).toEqual([]);
  });

  it('the screen formats displayed dates through formatHumanDate and nothing else', () => {
    /**
     * `toISOString` is deliberately **not** banned.
     *
     * The rule is that no ISO date is shown to a person. ISO on the wire is
     * correct and is what the API expects - `record-receipt-form.tsx` sends
     * `receivedAt` that way. Banning it outright flagged that form and would
     * have pushed a correct call into a workaround, which is a test dictating
     * a defect rather than preventing one.
     */
    expect(scan(/Intl\.DateTimeFormat|toLocaleDateString\(/)).toEqual([]);
  });

  it('no currency is written into the screen beside an amount', () => {
    /**
     * Banning the alternative formatters is not the whole rule.
     *
     * The defect this exists for is **"750 000 FCFA XAF"** - the currency
     * twice - and the second half of it does not need a formatter at all. A
     * literal "XAF" typed next to a rendered amount produces exactly the same
     * string, and the mechanism ban above sails straight past it. Verified by
     * writing one into a heading: every test still passed.
     *
     * So the currency itself is the thing banned. Every amount on this surface
     * comes through `<Money>`, which takes the currency from the payment row -
     * the record form's own label reads `Montant ({currency}, entier)` for the
     * same reason. There is no correct use of a hard-coded currency here: this
     * product is sold in XAF today and the schema stores the currency per
     * payment precisely because that is not a permanent fact.
     */
    expect(scan(/\b(XAF|FCFA|CFA|EUR|USD|GBP)\b/)).toEqual([]);
  });

  it('no displayed date is built by slicing an ISO string', () => {
    // The other way an ISO date reaches a screen: `createdAt.slice(0, 10)`.
    expect(scan(/\.slice\(0,\s*10\)/)).toEqual([]);
  });
});
