import fr from './messages/fr.json';
import en from './messages/en.json';

/**
 * Tests enforcing that public-facing pages do not inadvertently publish commitment
 * terms such as specific commission rates, bases, or payment deadlines.
 *
 * Verifies that explicit earning promises and 'J+n' payment delays are absent
 * from public namespaces, while allowing percentages in other legitimate contexts
 * (e.g. deposit amounts).
 */
type Json = Record<string, unknown>;

/**
 * What is NOT public, each with its reason. **Inverted, on purpose** (P21):
 * every namespace of the message files is watched unless it is declared here. A
 * list of what is watched misses whatever is added after it; a list of
 * exemptions has to be argued for, one line at a time.
 *
 * An entry is a namespace or a dotted key prefix.
 */
const EXEMPT: Readonly<Record<string, string>> = {
  app: "the signed-in spaces: an agent's own commissions are shown there, inside their own account",
  landsAdmin: 'the back office, read by staff only',
  'products.kbs.modulesDetail':
    'the KCA syllabus: a lecture on how an agent is paid teaches the rule, it promises nothing',
};

const isExempt = (key: string) =>
  Object.keys(EXEMPT).some((e) => key === e || key.startsWith(`${e}.`) || key.startsWith(`${e}[`));

/** Every string under a namespace, with its dotted path, arrays included. */
const leaves = (value: unknown, prefix: string): Array<[string, string]> => {
  if (typeof value === 'string') return [[prefix, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${prefix}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value as Json).flatMap(([k, v]) =>
      leaves(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [];
};

/** Every string of the file that no exemption covers. */
const publicCopy = (messages: unknown): Array<[string, string]> =>
  leaves(messages, '').filter(([k]) => !isExempt(k));

const LOCALES: ReadonlyArray<readonly [string, unknown]> = [
  ['fr', fr],
  ['en', en],
];

/** Regex matching percentage values. */
const RATE = /\d+(?:[.,]\d+)?\s*%|\d+\s*(?:pour cent|percent)\b/i;

/** Regex matching keywords indicating remuneration. */
const REMUNERATION =
  /commission|r[ée]mun[ée]ration|remuneration|vers[ée]s?\b|\bpaid\b|payout|valeur de vente|sale value|taux (?:personnel|de commission)/i;

/** Regex matching promised payment delays (e.g. J+15). */
const PAYMENT_DELAY = /\b[JD]\s*\+\s*\d+\b/;

/**
 * Any mention of an agent's remuneration. C14 - the scale - is not settled, so
 * no public page speaks of it at all, rate or not.
 * Word-bounded: "learn" and "earn your KCA certificate" are not remuneration.
 */
const REMUNERATION_MENTION =
  /\bcommissions?\b|\bcommissionnement\b|r[ée]mun[ée]ration|\bremuneration\b|\bpayouts?\b|\bgagne[rz]\b|\bearn (?:commissions?|money|income)\b|\bearnings\b|revenus compl[ée]mentaires|additional income/i;

const offenders = (entries: Array<[string, string]>, predicate: (v: string) => boolean) =>
  entries.filter(([, v]) => predicate(v)).map(([k, v]) => `${k} = ${v}`);

describe('P21 - public copy promises no rate, base or payment deadline', () => {
  /** A sweep that reads nothing passes every ban below it. */
  it.each(LOCALES)('%s: the sweep actually reads the public namespaces', (_locale, messages) => {
    const entries = publicCopy(messages);

    expect(entries.length).toBeGreaterThan(200);
    expect(entries.map(([k]) => k)).toContain('products.kamnet.hero.title');
  });

  it.each(LOCALES)('%s: no percentage is quoted as remuneration', (_locale, messages) => {
    const found = offenders(publicCopy(messages), (v) => RATE.test(v) && REMUNERATION.test(v));

    expect(found).toEqual([]);
  });

  it.each(LOCALES)('%s: no payment deadline is promised', (_locale, messages) => {
    const found = offenders(publicCopy(messages), (v) => PAYMENT_DELAY.test(v));

    expect(found).toEqual([]);
  });

  /**
   * Decision 1 of the arbitrage, widened: KAMNET sells no earning opportunity on
   * the public site, and no public string mentions remuneration at all.
   */
  it.each(LOCALES)('%s: no public string mentions remuneration', (_locale, messages) => {
    const found = offenders(publicCopy(messages), (v) => REMUNERATION_MENTION.test(v));

    expect(found).toEqual([]);
  });

  /** An exemption that names nothing is a hole waiting for a namespace to fill it. */
  it.each(LOCALES)('%s: every exemption names something that exists', (_locale, messages) => {
    const keys = leaves(messages, '').map(([k]) => k);
    const empty = Object.keys(EXEMPT).filter(
      (e) => !keys.some((k) => k === e || k.startsWith(`${e}.`) || k.startsWith(`${e}[`)),
    );

    expect(empty).toEqual([]);
  });

  /** The inversion itself: a namespace nobody has heard of is read, not skipped. */
  it('a namespace added tomorrow is watched without anyone listing it', () => {
    const tomorrow = { brandNewPage: { pitch: 'Rejoignez-nous et gagnez des commissions' } };
    const found = offenders(publicCopy(tomorrow), (v) => REMUNERATION_MENTION.test(v));

    expect(found).toEqual(['brandNewPage.pitch = Rejoignez-nous et gagnez des commissions']);
  });

  /**
   * Half of this defect shipped in two languages because nothing checked that
   * they move together. A key removed in one and left in the other is how this
   * file has broken before.
   */
  it('fr and en carry the same public keys', () => {
    const keys = (m: unknown) =>
      publicCopy(m)
        .map(([k]) => k)
        .sort();

    expect(keys(fr)).toEqual(keys(en));
  });
});
