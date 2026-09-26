import fr from './messages/fr.json';
import en from './messages/en.json';
import { staleExemptions, watchedCopy } from './watched-namespaces';

/**
 * Tests enforcing that public-facing pages do not inadvertently publish commitment
 * terms such as specific commission rates, bases, or payment deadlines.
 *
 * Verifies that explicit earning promises and 'J+n' payment delays are absent
 * from public namespaces, while allowing percentages in other legitimate contexts
 * (e.g. deposit amounts).
 */
/**
 * P10 - the namespaces that are NOT public, each with its reason. Everything
 * else in the message files is covered, including a namespace added tomorrow.
 *
 * This used to be a hand-kept list of PUBLIC namespaces, and the vocabulary
 * sweep read two product pages of it, so "Commission rapide" on the LANDS buyer
 * page and "gagner des commissions" in the quick actions shown on every public
 * page both passed. A new public namespace is now covered by default; a new
 * PRIVATE one is declared here, with its reason, where a reviewer sees it.
 */
const PRIVATE_NAMESPACES: Record<string, string> = {
  app: 'the authenticated product - an agent reads their own figures there once C14 settles them',
  landsAdmin: 'the back office - `landsAdmin.form.pv` is literally a commission coefficient',
};

const publicCopy = (messages: unknown): Array<[string, string]> =>
  watchedCopy(messages, PRIVATE_NAMESPACES);

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

/**
 * P10 - remuneration VOCABULARY, not only figures and phrases. "Commission
 * rapide" carries no rate and no promise phrase, so nothing above could see it.
 */
const REMUNERATION_VOCABULARY =
  /\b(?:commissions?|r[ée]mun[ée]r\w*|remunerat\w*|gagn(?:ez|er|ent|é)|revenus?|earn(?:s|ed|ing|ings)?|income)\b/i;

/**
 * Strings that use that vocabulary legitimately, one key at a time, each with
 * its reason. An entry that no longer exists or no longer matches fails the
 * stale test: an allowlist is a decision somebody can read.
 */
const ALLOWED_VOCABULARY: Record<string, string> = {
  'products.kbs.modulesDetail.items[3].lectures[3].title':
    'a KCA1 lesson title - it teaches that the agent never handles the money',
  'products.kbs.hero.certificateBadge': 'earns a CERTIFICATE (en: "Earn your KCA certificate")',
};

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
   * Decision 1 of the arbitrage: nothing on a public page describes what an
   * agent earns. Every public namespace, not two product pages.
   */
  it.each(LOCALES)('%s: public copy uses no remuneration vocabulary', (_locale, messages) => {
    const found = offenders(
      publicCopy(messages).filter(([k]) => !(k in ALLOWED_VOCABULARY)),
      (v) => REMUNERATION_VOCABULARY.test(v) || EARNING_PROMISE.test(v),
    );

    expect(found).toEqual([]);
  });

  it('every allowlisted key still exists and still matches, in one language at least', () => {
    const matchesSomewhere = (k: string) =>
      [fr, en].some((m) => REMUNERATION_VOCABULARY.test(new Map(publicCopy(m)).get(k) ?? ''));
    expect(Object.keys(ALLOWED_VOCABULARY).filter((k) => !matchesSomewhere(k))).toEqual([]);
  });

  it('covers every namespace but the declared private ones, and declares none that is gone', () => {
    for (const m of [fr, en]) {
      expect(staleExemptions(m, PRIVATE_NAMESPACES)).toEqual([]);
      const covered = new Set(publicCopy(m).map(([k]) => k.split(/[.[]/)[0]));
      expect(covered.has('app') || covered.has('landsAdmin')).toBe(false);
      expect(covered.size).toBe(Object.keys(m).length - Object.keys(PRIVATE_NAMESPACES).length);
    }
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
