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
 * Namespaces served to people with no account, or before one matters.
 *
 * Deliberately NOT the whole file: `app` and `landsAdmin` are excluded above.
 */
const PUBLIC_NAMESPACES = [
  'about',
  'auth',
  'blog',
  'contact',
  'faq',
  'footer',
  'hero',
  'homeCta',
  'howItWorks',
  'landTypes',
  'landsHero',
  'legal',
  'metadata',
  'methode',
  'nav',
  'notFound',
  'plan',
  'process',
  'products',
  'quickActions',
  'why',
  'whyBuyAtKambriq',
] as const;

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

const publicCopy = (messages: unknown): Array<[string, string]> =>
  PUBLIC_NAMESPACES.flatMap((ns) => leaves((messages as Json)[ns], ns));

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
 * Regex matching specific phrases that promise earnings to an agent.
 * Specifically excludes generic educational mentions of "commission" or "earn".
 */
const EARNING_PROMISE =
  /gagnez|earn while|earn (?:commissions?|money|income)|\bearnings\b|commissions? attractives?|attractive commissions?|g[ée]n[ée]rez[^.]*commission|generate[^.]*commission|revenus compl[ée]mentaires|additional income|syst[èe]me de commissionnement|multi-level commission|structure des commissions|commission structure|commissions?[^.]*vers[ée]|commission[^.]*\bpaid\b/i;

/** KCA1 syllabus namespace, excluded from earning promises checks. */
const SYLLABUS = 'products.kbs.modulesDetail';

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
   * Decision 1 of the arbitrage: KAMNET no longer sells an earning opportunity
   * on the public site. Scoped to the two product pages that made the promise,
   * because "commission" is a legitimate word elsewhere - a FAQ answer about
   * how the company makes money is not a promise to an agent.
   */
  it.each(LOCALES)('%s: the product pages promise no earnings', (_locale, messages) => {
    const entries = [
      ...leaves((messages as Json)['products'], 'products').filter(
        ([k]) => k.startsWith('products.kamnet') || k.startsWith('products.kbs'),
      ),
    ];
    const found = offenders(
      entries.filter(([k]) => !k.startsWith(SYLLABUS)),
      (v) => EARNING_PROMISE.test(v),
    );

    expect(found).toEqual([]);
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
