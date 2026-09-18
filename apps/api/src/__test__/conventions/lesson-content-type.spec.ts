import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  FILE_BACKED_CONTENT_TYPES,
  LESSON_CONTENT_TYPES,
} from '@kambriq/common/constants/kbs/lesson-content';

/**
 * A4 - the value a lesson is seeded with must be a value the read path accepts.
 *
 * The two sides are compared here, not asserted separately, because each side
 * was internally consistent while together they were broken: the seed wrote
 * `'video'` and every reader tested `'VIDEO'`, so `LessonBody` fell through to
 * its final dash and six seeded lessons on dev rendered no content at all. A
 * test that checked only "the seed writes a content type" would have passed,
 * and so would one that checked only "the view handles four types".
 *
 * Reading the source files rather than importing them is deliberate: `seed.ts`
 * is a script with top-level effects, and the web view is a `.tsx` module in
 * another project. This is the same instrument as `role-code-literals.spec.ts`
 * and `kamnet-enums-mirror-the-schema.spec.ts`, and for the same reason.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');

const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

/** Comments are stripped first: a comment quoting the old bug is not a write. */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const SEED = stripComments(read('prisma', 'seed.ts'));
const SERVICE = stripComments(read('apps', 'api', 'src', 'kbs', 'courses', 'courses.service.ts'));
const VIEW = stripComments(read('apps', 'web', 'src', 'components', 'kbs', 'kbs-lesson-view.tsx'));
const LOADER = stripComments(read('prisma', 'seed-data', 'kca1-loader.ts'));

/** Every `contentType: '<literal>'` the seed assigns. */
const seededLiterals = (source: string): string[] =>
  [...source.matchAll(/contentType:\s*'([^']*)'/g)].map((m) => m[1]);

/** Every `contentType: LessonContentType.X` the seed assigns. */
const seededConstants = (source: string): string[] =>
  [...source.matchAll(/contentType:\s*LessonContentType\.([A-Z]+)/g)].map((m) => m[1]);

/** Every value a `contentType === '<literal>'` comparison accepts. */
const comparedLiterals = (source: string): string[] =>
  [...source.matchAll(/contentType\s*===\s*'([^']*)'/g)].map((m) => m[1]);

/** Every value a `contentType === LessonContentType.X` comparison accepts. */
const comparedConstants = (source: string): string[] =>
  [...source.matchAll(/contentType\s*===\s*LessonContentType\.([A-Z]+)/g)].map((m) => m[1]);

describe('lesson content type: one spelling, and both sides agree', () => {
  it('is reading the files it thinks it is', () => {
    expect(SEED).toContain('kbsLesson.upsert');
    expect(SERVICE).toContain('getDownloadUrl');
    expect(VIEW).toContain('LessonBody');
    expect(LOADER).toContain('LESSON_CONTENT_TYPE');
  });

  /**
   * The defect itself. Every value the seed writes has to be one the read path
   * can act on; `'video'` is not `'VIDEO'` and Postgres comparison is not
   * case-insensitive.
   */
  it('seeds no content type the read path would reject', () => {
    const written = [...seededLiterals(SEED), ...seededConstants(SEED)];

    expect(written.length).toBeGreaterThan(0);
    for (const value of written) {
      expect(LESSON_CONTENT_TYPES).toContain(value);
    }
  });

  /**
   * And the direction that keeps the fix from rotting: the spelling may be
   * written once. A bare literal in the seed is how the two copies drifted the
   * first time.
   */
  it('writes the value through the shared constant, never as a bare literal', () => {
    expect(seededLiterals(SEED)).toEqual([]);
    expect(seededConstants(SEED).length).toBeGreaterThan(0);
  });

  /**
   * The web view is the surface a candidate actually sees, and it must branch
   * on every declared type or some lesson renders a dash.
   *
   * It is asserted through the constant rather than through literals on
   * purpose. Checking that the view compares `'VIDEO'`, `'PDF'`, `'HTML'` and
   * `'TEXT'` would pass today and would have to be deleted the moment the view
   * stops writing those strings - a test that fails when the code becomes
   * correct is the `returns null for unknown job types` entry in CLAUDE.md.
   */
  it('branches on every declared content type, through the constant', () => {
    const branched = new Set(comparedConstants(VIEW));

    expect([...branched].sort()).toEqual([...LESSON_CONTENT_TYPES].sort());
    expect(comparedLiterals(VIEW)).toEqual([]);
  });

  /**
   * The service signs a URL for exactly the file-backed types, and it asks the
   * shared helper rather than spelling the pair again. Two places that each
   * decide what "file backed" means is the same defect one level down.
   */
  it('delegates the file-backed decision instead of spelling it again', () => {
    expect(SERVICE).toContain('isFileBackedContentType');
    expect(comparedLiterals(SERVICE)).toEqual([]);
    expect(FILE_BACKED_CONTENT_TYPES.length).toBe(2);
  });

  /** The loader generates lessons, so it is a writer like the seed. */
  it('has the loader take its content type from the shared constant', () => {
    expect(LOADER).toContain('lesson-content');
    expect(LOADER).not.toMatch(/LESSON_CONTENT_TYPE\s*=\s*'HTML'/);
  });
});
