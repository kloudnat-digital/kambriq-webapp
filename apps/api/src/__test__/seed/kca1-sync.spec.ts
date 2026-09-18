/* eslint-disable @nx/enforce-module-boundaries -- the sync rules live in prisma/seed-data, outside any nx project; these tests exist to pin them */
import {
  ORPHAN_ORDER_BASE,
  matchLessons,
  normaliseTitle,
  orphanOrder,
  summarise,
  type ExistingLesson,
  type SourceLesson,
} from '../../../../../prisma/seed-data/kca1-sync';

/**
 * Step 3 - what a second load over an edited source means, decided here.
 *
 * The database half is proved in `kca1-replay.dbspec.ts`, against real Postgres
 * and two genuinely different documents. This file pins the decision itself, so
 * the rules can be read and mutated without a database.
 */

const source = (
  moduleNumber: number,
  title: string,
  extra: Partial<SourceLesson> = {},
): SourceLesson => ({
  key: `P0/M${moduleNumber}`,
  moduleNumber,
  title,
  goal: 'un objectif',
  durationMinutes: 10,
  contentHtml: '<p>corps</p>',
  ...extra,
});

const existing = (
  id: string,
  title: string,
  order: number,
  extra: Partial<ExistingLesson> = {},
): ExistingLesson => ({
  id,
  title,
  order,
  duration: 10,
  content: '<p>corps</p>',
  ...extra,
});

describe('KCA1 replay - title normalisation', () => {
  it('treats case, accents and spacing as the same title', () => {
    expect(normaliseTitle('  Ethique  ET  Conformite ')).toBe(
      normaliseTitle('ethique et conformite'),
    );
    expect(normaliseTitle('Ethique')).toBe(normaliseTitle('Éthique'));
  });

  it('keeps genuinely different titles apart', () => {
    expect(normaliseTitle('Premier module')).not.toBe(normaliseTitle('Deuxieme module'));
  });
});

describe('KCA1 replay - matching', () => {
  it('creates a lesson the database has never seen', () => {
    const matches = matchLessons([source(1, 'Tout nouveau')], []);

    expect(matches).toHaveLength(1);
    expect(matches[0].outcome).toBe('created');
    expect(matches[0].existingId).toBeNull();
  });

  it('leaves an identical lesson alone', () => {
    const matches = matchLessons(
      [source(1, 'Premier module')],
      [existing('a', 'Premier module', 1)],
    );

    expect(matches[0].outcome).toBe('unchanged');
    expect(matches[0].existingId).toBe('a');
    expect(matches[0].changes).toEqual([]);
  });

  it('updates a lesson whose body or duration changed', () => {
    const matches = matchLessons(
      [source(1, 'Premier module', { durationMinutes: 25, contentHtml: '<p>nouveau corps</p>' })],
      [existing('a', 'Premier module', 1)],
    );

    expect(matches[0].outcome).toBe('updated');
    expect(matches[0].existingId).toBe('a');
    expect(matches[0].changes.sort()).toEqual(['content', 'duration']);
  });

  /**
   * The case step 1 got wrong. Removing a module makes the document renumber,
   * so the surviving lesson's number changes while it stays the same lesson.
   * Matching on the number alone would hand its identity to a different row.
   */
  it('follows a lesson that moved, by its title', () => {
    const matches = matchLessons(
      [source(1, 'Premier module'), source(2, 'Troisieme module')],
      [
        existing('a', 'Premier module', 1),
        existing('b', 'Deuxieme module', 2),
        existing('c', 'Troisieme module', 3),
      ],
    );

    const moved = matches.find((m) => m.source?.title === 'Troisieme module');
    expect(moved?.outcome).toBe('moved');
    expect(moved?.existingId).toBe('c');
    expect(moved?.matchedBy).toBe('title');
  });

  /** And the opposite signal: the number held, the title was edited. */
  it('follows a lesson that was retitled, by its module number', () => {
    const matches = matchLessons(
      [source(3, 'Troisieme module, retitre par Visquis')],
      [existing('c', 'Troisieme module du parcours un', 3)],
    );

    expect(matches[0].outcome).toBe('renamed');
    expect(matches[0].existingId).toBe('c');
    expect(matches[0].matchedBy).toBe('module-number');
  });

  /**
   * Never deleted. `KbsLessonCompletion.lesson` cascades, so a delete destroys
   * completions a candidate earned.
   */
  it('keeps a lesson the source no longer mentions, and says so', () => {
    const matches = matchLessons(
      [source(1, 'Premier module')],
      [existing('a', 'Premier module', 1), existing('b', 'Deuxieme module', 2)],
    );

    const gone = matches.find((m) => m.existingId === 'b');
    expect(gone?.outcome).toBe('absent-from-source');
    expect(gone?.source).toBeNull();
  });

  it('never matches one database row to two source lessons', () => {
    const matches = matchLessons(
      [source(1, 'Premier module'), source(2, 'Premier module')],
      [existing('a', 'Premier module', 1)],
    );

    const claimed = matches.filter((m) => m.existingId === 'a');
    expect(claimed).toHaveLength(1);
  });

  /** The whole edit in one go, which is what the acceptance actually describes. */
  it('handles a retitle, an addition and a removal together', () => {
    const matches = matchLessons(
      [source(1, 'Premier module'), source(2, 'Troisieme module'), source(3, 'Quatrieme module')],
      [
        existing('a', 'Premier module', 1),
        existing('b', 'Deuxieme module', 2),
        existing('c', 'Troisieme module', 3),
      ],
    );

    expect(summarise(matches)).toEqual({
      created: 1,
      unchanged: 1,
      updated: 0,
      moved: 1,
      renamed: 0,
      'absent-from-source': 1,
    });
  });
});

describe('KCA1 replay - parking an orphan', () => {
  /**
   * Forced by `@@unique([moduleId, order])`: an orphan still holding order 3
   * collides with whichever lesson renumbers into 3, and the load would die on
   * a constraint instead of reporting what it found.
   */
  it('parks orphans above the live ordering band', () => {
    expect(orphanOrder(0)).toBeGreaterThanOrEqual(ORPHAN_ORDER_BASE);
    expect(orphanOrder(1)).toBeGreaterThan(orphanOrder(0));
  });
});
