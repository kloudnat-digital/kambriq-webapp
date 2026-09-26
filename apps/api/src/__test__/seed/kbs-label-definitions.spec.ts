/* eslint-disable @nx/enforce-module-boundaries -- the seed bank lives in prisma/seed-data, outside any nx project; these tests exist to pin it */
import {
  KBS_LABELS,
  KBS_LABEL_DEFINITIONS,
  kbsLabelDescriptionText,
  type KbsLabelCode,
} from '@kambriq/common';
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
 * WHAT IT DOES: `libs/common/src/kbs/label-definitions.ts` is the single
 * authoritative statement of the three labels. This test fails when the seed
 * bank contradicts it, and it fails again when a definition itself moves. Either
 * way somebody has to re-read both rather than let them silently diverge.
 *
 * WHY IT EXISTS: commits 1691b67 and 21ceed7 both corrected these definitions.
 * They were then regenerated wrong a third time, from fluent text produced
 * without reading the source - including "a VEFL parcel has no title", which is
 * the inverse of the product, in the material that trains the agents who sell
 * it. Vigilance had already failed twice, so this is a mechanism instead.
 *
 * WHY IT NO LONGER READS `methode/fr.mdx`: wave 7 moved editorial prose into
 * Sanity, and a Sanity document cannot be read by a test - CI has no token. The
 * labels therefore stopped being prose: they are fields in that file, the
 * `methode` page renders them through a block that carries no text of its own,
 * and the migration refused to run until the constants reproduced the mdx
 * character for character in both languages. So this reads the same values the
 * page prints, which the mdx never was.
 */

/** The expansions, as the definitions state them. */
const EXPANSIONS: Record<string, string> = Object.fromEntries(
  KBS_LABELS.map((code) => [code, KBS_LABEL_DEFINITIONS[code].expansion]),
);

const BANK: SeedQuestion[] = [
  ...MODULE_1_QUIZ,
  ...MODULE_2_QUIZ,
  ...MODULE_1_EXAM,
  ...MODULE_2_EXAM,
];

describe('label definitions: the authoritative source is intact', () => {
  /**
   * A tripwire, not a restatement. These four booleans are the product, and a
   * change to one of them is a change to what KAMBRIQ sells - so it fails here
   * and somebody re-reads the question bank against the new value rather than
   * discovering the divergence from a candidate.
   */
  it.each([
    [
      'TFL',
      {
        titleExists: true,
        registrationComplete: true,
        subdivisionComplete: true,
        ownerAtSignature: true,
      },
    ],
    [
      'VEFL',
      {
        titleExists: true,
        registrationComplete: true,
        subdivisionComplete: false,
        ownerAtSignature: false,
      },
    ],
    [
      'VEFIL',
      {
        titleExists: false,
        registrationComplete: false,
        subdivisionComplete: false,
        ownerAtSignature: false,
      },
    ],
  ] as [KbsLabelCode, Record<string, boolean>][])(
    '%s still states the same four facts',
    (code, facts) => {
      expect(KBS_LABEL_DEFINITIONS[code]).toMatchObject(facts);
    },
  );

  it.each(Object.entries(EXPANSIONS))('%s still expands to "%s"', (code, expansion) => {
    expect(KBS_LABEL_DEFINITIONS[code as KbsLabelCode].expansion).toBe(expansion);
  });

  it.each(KBS_LABELS)('%s says the same thing in both languages', (code) => {
    const definition = KBS_LABEL_DEFINITIONS[code];
    // Not a translation check. Both descriptions must exist and be substantial:
    // an empty one would render a label with a heading and nothing under it.
    expect(kbsLabelDescriptionText(definition, 'fr').length).toBeGreaterThan(80);
    expect(kbsLabelDescriptionText(definition, 'en').length).toBeGreaterThan(80);
  });

  it('VEFIL is the only label whose buyer does not own at signature alone', () => {
    // The distinction the blockquote on /methode exists for: VEFIL is not VEFL.
    // Derived from the fields rather than written out again, so the two cannot
    // disagree.
    const notOwner = KBS_LABELS.filter((code) => !KBS_LABEL_DEFINITIONS[code].ownerAtSignature);
    expect(notOwner).toEqual(['VEFL', 'VEFIL']);
    expect(KBS_LABEL_DEFINITIONS.VEFIL.registrationComplete).toBe(false);
    expect(KBS_LABEL_DEFINITIONS.VEFL.registrationComplete).toBe(true);
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

  it.each(KBS_LABELS.filter((code) => KBS_LABEL_DEFINITIONS[code].titleExists))(
    'no question claims a %s parcel lacks a title',
    (code) => {
      // The specific regression: VEFL has the title already, only the
      // subdivision is pending. A correct answer saying otherwise inverts the
      // product. Which labels this applies to is read from `titleExists`.
      const questions = BANK.filter((q) => q.q.includes(code));
      for (const q of questions) {
        expect(q.a[q.correct]).not.toMatch(/n'existe pas encore|pas de titre|aucun titre/i);
      }
    },
  );

  it.each(KBS_LABELS.filter((code) => !KBS_LABEL_DEFINITIONS[code].ownerAtSignature))(
    'no question claims a %s buyer owns the land at signature',
    (code) => {
      const questions = BANK.filter((q) => q.q.includes(code) && /propriétaire/i.test(q.q));
      for (const q of questions) {
        expect(q.a[q.correct]).toMatch(/^Non/);
      }
    },
  );

  it('every label mentioned in the bank is one the definitions declare', () => {
    const mentioned = new Set<string>();
    for (const q of BANK) {
      for (const code of KBS_LABELS) {
        if (q.q.includes(code)) mentioned.add(code);
      }
    }
    for (const code of mentioned) expect(Object.keys(EXPANSIONS)).toContain(code);
  });
});
