import fr from './messages/fr.json';
import en from './messages/en.json';

/**
 * P21 - the public site may not publish a rate, a base or a payment deadline.
 *
 * `products.kamnet.commissions` announced, in both languages, "3% de la valeur
 * de vente - versés à J+15 après validation de la transaction". A rate, a base
 * and a deadline together are a commitment, and no such rate exists anywhere in
 * the platform: C14 establishes that the 5% figure lives in three seed literals
 * and a comment, and the grid has never been settled. The site promised agents
 * money that nothing computes and nothing pays.
 *
 * ---------------------------------------------------------------------------
 * Why this bans a rate IN CONTEXT rather than every percentage
 * ---------------------------------------------------------------------------
 * A test that forbids `%` on public pages fires on eight honest strings: "100%
 * en ligne", "Score minimal : 80 %", "évite 80% des erreurs terrain", "plus de
 * 95% du territoire", and four "Acompte ... 5%" lines. That last one matters
 * most - the buyer's 5% deposit is real, implemented and charged - so a guard
 * that refuses it would be deleted by the first person it blocked, which is the
 * fate of every guard that cries wolf.
 *
 * What is banned is a percentage that appears WITH remuneration wording - a
 * commission, a sale value, something being paid out - and any J+n / D+n
 * payment delay at all. That second pattern occurs exactly once in the entire
 * message file, in the string this subject exists to delete.
 *
 * ---------------------------------------------------------------------------
 * Why the namespaces are listed rather than derived
 * ---------------------------------------------------------------------------
 * `app` is the authenticated product and `landsAdmin` is the back office; both
 * legitimately carry figures, and `landsAdmin.form.pv` is literally called
 * "coefficient de commission". Once C14 settles a real grid, the agent's own
 * space will carry rates too. A guard that forbade them everywhere would be
 * removed the day it blocked that work, so the public surface is named
 * explicitly and stays auditable.
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
  'landSearch',
  'landTypes',
  'landsCompare',
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

/** A percentage, written either way. */
const RATE = /\d+(?:[.,]\d+)?\s*%|\d+\s*(?:pour cent|percent)\b/i;

/** Wording that turns a number into somebody's remuneration. */
const REMUNERATION =
  /commission|r[ée]mun[ée]ration|remuneration|vers[ée]s?\b|\bpaid\b|payout|valeur de vente|sale value|taux (?:personnel|de commission)/i;

/** "versés à J+15" / "paid at D+15" - a promise about when money arrives. */
const PAYMENT_DELAY = /\b[JD]\s*\+\s*\d+\b/;

/**
 * The earning promise itself, which the 20 September arbitrage removes.
 *
 * NARROWED after watching the first run. `/commission|earn/` flagged two honest
 * strings, and both are the shape this repository keeps relearning - the copy
 * that explains a thing is the first casualty of a sweep that bans the word:
 *
 *   - "Argent & commissions - Pourquoi l'agent ne touche jamais l'argent" is a
 *     KCA1 LESSON TITLE, teaching that the agent never handles the money. It
 *     says the opposite of a promise, and banning it would delete real
 *     curriculum;
 *   - "Earn your KCA certificate" earns a certificate, not an income.
 *
 * So this matches phrases that promise MONEY TO THE AGENT, not the words
 * "commission" or "earn" wherever they appear.
 */
const EARNING_PROMISE =
  /gagnez|earn while|earn (?:commissions?|money|income)|\bearnings\b|commissions? attractives?|attractive commissions?|g[ée]n[ée]rez[^.]*commission|generate[^.]*commission|revenus compl[ée]mentaires|additional income|syst[èe]me de commissionnement|multi-level commission|structure des commissions|commission structure|commissions?[^.]*vers[ée]|commission[^.]*\bpaid\b/i;

/**
 * The loaded KCA1 syllabus, excluded from the earning sweep.
 *
 * `modulesDetail` is course content injected from Visquis's source document -
 * lesson titles, goals and durations. It describes what is taught, including
 * how money works, and it is not a promise made to a visitor.
 */
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
