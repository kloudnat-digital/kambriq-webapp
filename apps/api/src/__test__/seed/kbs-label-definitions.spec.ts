/* eslint-disable @nx/enforce-module-boundaries -- the seed bank lives in prisma/seed-data, outside any nx project; these tests exist to pin it */
import * as fs from 'fs';
import * as path from 'path';
import {
  MODULE_1_QUIZ,
  MODULE_2_QUIZ,
  MODULE_1_EXAM,
  MODULE_2_EXAM,
  type SeedQuestion,
} from '../../../../../prisma/seed-data/kbs-questions';

/**
 * Pins the TFL / VEFL / VEFIL definitions to the authoritative source.
 *
 * WHAT THIS TEST DOES NOT DO: it cannot verify that a question is legally
 * correct. Nothing here reads Cameroonian land law. Do not treat a green run as
 * a legal review, and do not add questions on the strength of it.
 *
 * WHAT IT DOES: apps/web/src/content/methode/fr.mdx is the single authoritative
 * statement of the three labels. This test fails when the seed bank contradicts
 * it, and it fails again when the mdx itself changes. Either way somebody has to
 * re-read both rather than let them silently diverge.
 *
 * WHY IT EXISTS: commits 1691b67 and 21ceed7 both corrected these definitions.
 * They were then regenerated wrong a third time, from fluent text produced
 * without reading the mdx — including "a VEFL parcel has no title", which is the
 * inverse of the product, in the material that trains the agents who sell it.
 * Vigilance had already failed twice, so this is a mechanism instead.
 */

const MDX = path.resolve(__dirname, '../../../../../apps/web/src/content/methode/fr.mdx');

const mdx = (): string => fs.readFileSync(MDX, 'utf8');

/** The expansions, as the mdx states them. */
const EXPANSIONS: Record<string, string> = {
  TFL: 'Titre Foncier Loti',
  VEFL: 'Vente en État Futur de Lotissement',
  VEFIL: "Vente en État Futur d'Immatriculation et de Lotissement",
};

/**
 * Substantive claims taken verbatim from the mdx. If any disappears, the
 * authoritative text has moved and the bank must be re-read against it.
 */
const ANCHORS: string[] = [
  // TFL: individual title already established.
  'Le terrain possède un titre foncier individuel établi',
  // VEFL: the title EXISTS; registration is done; only the subdivision is pending.
  "Le titre foncier existe déjà - l'immatriculation est faite",
  // VEFIL: registration still under way, and the buyer is NOT the owner at signature.
  "L'immatriculation est en cours",
  'propriétaire à la signature',
];

const BANK: SeedQuestion[] = [
  ...MODULE_1_QUIZ,
  ...MODULE_2_QUIZ,
  ...MODULE_1_EXAM,
  ...MODULE_2_EXAM,
];

describe('label definitions: the authoritative source is intact', () => {
  it('methode/fr.mdx exists and still names all three labels', () => {
    const text = mdx();
    for (const code of Object.keys(EXPANSIONS)) {
      expect(text).toContain(`KAMBRIQ ${code}`);
    }
  });

  it.each(Object.entries(EXPANSIONS))('%s still expands to "%s" in the mdx', (_code, expansion) => {
    expect(mdx()).toContain(expansion);
  });

  it.each(ANCHORS)('the mdx still states: "%s"', (anchor) => {
    // A failure here does not mean the mdx is wrong. It means it changed, and
    // the seed bank has to be read against the new text before this is updated.
    expect(mdx()).toContain(anchor);
  });
});

describe('label definitions: the seed bank does not contradict them', () => {
  it.each(Object.entries(EXPANSIONS))(
    'any question asking what %s means answers "%s"',
    (code, expansion) => {
      const asking = BANK.filter(
        (q) => q.q.includes(code) && /signifie|désigne|veut dire/i.test(q.q),
      );
      expect(asking.length).toBeGreaterThan(0);
      for (const q of asking) {
        expect(q.a[q.correct]).toBe(expansion);
      }
    },
  );

  it('no question claims a VEFL parcel lacks a title', () => {
    // The specific regression: VEFL has the title already, only the subdivision
    // is pending. A correct answer saying otherwise inverts the product.
    const vefl = BANK.filter((q) => q.q.includes('VEFL'));
    for (const q of vefl) {
      const correct = q.a[q.correct];
      expect(correct).not.toMatch(/n'existe pas encore|pas de titre|aucun titre/i);
    }
  });

  it('no question claims a VEFIL buyer owns the land at signature', () => {
    const vefil = BANK.filter((q) => q.q.includes('VEFIL') && /propriétaire/i.test(q.q));
    for (const q of vefil) {
      expect(q.a[q.correct]).toMatch(/^Non/);
    }
  });

  it('every label mentioned in the bank is one the mdx defines', () => {
    const mentioned = new Set<string>();
    for (const q of BANK) {
      for (const code of ['TFL', 'VEFL', 'VEFIL']) {
        if (q.q.includes(code)) mentioned.add(code);
      }
    }
    for (const code of mentioned) expect(Object.keys(EXPANSIONS)).toContain(code);
  });
});
