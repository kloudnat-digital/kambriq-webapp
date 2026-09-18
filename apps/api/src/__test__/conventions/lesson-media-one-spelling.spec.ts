import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LESSON_MEDIA_KINDS } from '@kambriq/common/constants/kbs/lesson-media';

/**
 * A3 - the three media kinds are named in one place, and the schema points at it.
 *
 * `KbsLessonMedia.kind` holds VIDEO, IMAGE or DOCUMENT. Without this, that list
 * lives in three: the Prisma schema comment, the loader that writes the rows,
 * and whatever reads them. That is the defect `lesson-content.ts` closed one
 * level down - `prisma/seed.ts` wrote `'video'` while every reader compared
 * `'VIDEO'`, and six seeded lessons rendered nothing at all.
 *
 * So the schema comment names the file rather than the values. A comment that
 * restates the list is a fourth copy that nothing keeps honest: it is prose, it
 * cannot be imported, and it is wrong silently.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');

const SCHEMA = readFileSync(join(ROOT, 'prisma', 'kbs', 'schema.prisma'), 'utf8');
const LOADER = readFileSync(join(ROOT, 'prisma', 'seed-data', 'kca1-loader.ts'), 'utf8');

/** The `model KbsLessonMedia { ... }` block, comments included. */
const modelBlock = (): string => {
  const match = /model KbsLessonMedia \{[\s\S]*?\n\}/.exec(SCHEMA);
  if (!match) throw new Error('model KbsLessonMedia not found in prisma/kbs/schema.prisma');
  return match[0];
};

describe('lesson media kinds: one spelling, and the schema points at it', () => {
  it('is reading the files it thinks it is', () => {
    expect(SCHEMA).toContain('model KbsLessonMedia');
    expect(LOADER).toContain('Kca1MarkerKind');
  });

  it('names three kinds and no more', () => {
    expect([...LESSON_MEDIA_KINDS].sort()).toEqual(['DOCUMENT', 'IMAGE', 'VIDEO']);
  });

  /**
   * The point of the rule. A schema comment listing the values would read as
   * documentation and drift the day the list changes, with nothing to catch it.
   */
  it('does not restate the values in the schema', () => {
    const block = modelBlock();

    for (const kind of LESSON_MEDIA_KINDS) {
      expect(block).not.toContain(kind);
    }
  });

  it('points at the file that does name them', () => {
    expect(modelBlock()).toContain('libs/common/src/constants/kbs/lesson-media.ts');
    expect(modelBlock()).toContain('LESSON_MEDIA_KINDS');
  });

  /**
   * The loader writes those rows, so it is the other side of the same list. It
   * must take the type from the shared module rather than declaring a union of
   * its own, which is how the first copy always starts.
   */
  it('has the loader take the kind from the shared module', () => {
    expect(LOADER).toContain('lesson-media');
    expect(LOADER).not.toMatch(/Kca1MarkerKind\s*=\s*'VIDEO'/);
  });
});
