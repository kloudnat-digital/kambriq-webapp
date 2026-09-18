/* eslint-disable @nx/enforce-module-boundaries -- the loader, the sync rules and the apply live in prisma/, outside any nx project; this test exists to pin them against a real database */
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { LessonContentType } from '@kambriq/common/constants/kbs/lesson-content';
import { applyLessons } from '../../../../../prisma/kca1-apply';
import { ORPHAN_ORDER_BASE } from '../../../../../prisma/seed-data/kca1-sync';
import { parseCourseHtml, type Kca1Lesson } from '../../../../../prisma/seed-data/kca1-loader';
import { openKbsTestDatabase, type KbsTestDatabase } from './kbs-test-db';

/**
 * Step 3 - a second load over an EDITED source keeps what candidates earned.
 *
 * The two runs consume two different documents. That is the whole point: a
 * replay test over an unchanged source asserts nothing about replay, the same
 * way the em-dash assertion asserted nothing while no source contained one.
 * `kca1-replay-before.docx` and `kca1-replay-after.docx` differ by three edits
 * at once, which is what a real revision looks like:
 *
 *   - P1's third lesson is RETITLED (its number is unchanged);
 *   - P0's second lesson is REMOVED, which makes the document renumber, so
 *     P0's third lesson becomes its second;
 *   - a fourth lesson is ADDED to P1.
 *
 * Nothing is mocked below the service: real Postgres, real migrations, real
 * constraints - including `@@unique([moduleId, order])`, which is what forces
 * the two-phase write, and `onDelete: Cascade` on completions, which is why a
 * lesson leaving the source is never deleted.
 */
const FIXTURES = join(__dirname, '__fixtures__');

const parse = async (file: string) => {
  const mammoth = require('mammoth');
  const html = (await mammoth.convertToHtml({ path: join(FIXTURES, file) })).value as string;
  return parseCourseHtml(html);
};

const asSource = (lesson: Kca1Lesson) => ({
  key: lesson.key,
  moduleNumber: lesson.moduleNumber,
  title: lesson.title,
  goal: lesson.goal,
  durationMinutes: lesson.durationMinutes,
  contentHtml: lesson.contentHtml,
});

describe('KCA1 replay - an edited source does not cost a candidate their progress', () => {
  let db: KbsTestDatabase;
  const courseId = randomUUID();
  const p0ModuleId = randomUUID();
  const p1ModuleId = randomUUID();
  const candidateId = randomUUID();

  /** The lesson the candidate completed, captured before the second load. */
  let completedLessonId: string;
  let p0RemovedLessonId: string;

  beforeAll(async () => {
    db = openKbsTestDatabase();

    await db.prisma.kbsCourse.create({
      data: { id: courseId, title: `Replay ${courseId}`, description: 'replay fixture' },
    });
    await db.prisma.kbsModule.create({
      data: { id: p0ModuleId, courseId, title: 'P0', description: 'parcours zero', order: 1 },
    });
    await db.prisma.kbsModule.create({
      data: { id: p1ModuleId, courseId, title: 'P1', description: 'parcours un', order: 2 },
    });
    await db.prisma.kbsCandidate.create({
      data: { id: candidateId, userId: randomUUID(), status: 'IN_TRAINING' },
    });

    // ---- first load, from the BEFORE document
    const before = await parse('kca1-replay-before.docx');
    for (const [index, parcours] of before.parcours.entries()) {
      await applyLessons(db.prisma.kbsLesson, {
        moduleId: index === 0 ? p0ModuleId : p1ModuleId,
        parcours: parcours.code,
        source: parcours.lessons.map(asSource),
        contentType: LessonContentType.HTML,
      });
    }

    const p1Lessons = await db.prisma.kbsLesson.findMany({
      where: { moduleId: p1ModuleId },
      orderBy: { order: 'asc' },
    });
    const third = p1Lessons[2];
    completedLessonId = third.id;

    const p0Lessons = await db.prisma.kbsLesson.findMany({
      where: { moduleId: p0ModuleId },
      orderBy: { order: 'asc' },
    });
    p0RemovedLessonId = p0Lessons[1].id;

    // The candidate completes lesson 3 of P1, and has module progress recorded.
    await db.prisma.kbsLessonCompletion.create({
      data: { candidateId, lessonId: completedLessonId },
    });
    await db.prisma.kbsCandidateProgress.create({
      data: { candidateId, moduleId: p1ModuleId, score: 80, passed: true, attempts: 1 },
    });
  }, 60_000);

  afterAll(async () => {
    await db.prisma.kbsCourse.deleteMany({ where: { id: courseId } });
    await db.prisma.kbsCandidate.deleteMany({ where: { id: candidateId } });
    await db.close();
  });

  it('starts from a first load that really wrote the before document', async () => {
    const p0 = await db.prisma.kbsLesson.count({ where: { moduleId: p0ModuleId } });
    const p1 = await db.prisma.kbsLesson.count({ where: { moduleId: p1ModuleId } });

    expect(p0).toBe(3);
    expect(p1).toBe(3);
  });

  it('runs the second load over a document that genuinely differs', async () => {
    const before = await parse('kca1-replay-before.docx');
    const after = await parse('kca1-replay-after.docx');

    // If these were equal the assertions below would prove nothing about replay.
    expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));

    for (const [index, parcours] of after.parcours.entries()) {
      await applyLessons(db.prisma.kbsLesson, {
        moduleId: index === 0 ? p0ModuleId : p1ModuleId,
        parcours: parcours.code,
        source: parcours.lessons.map(asSource),
        contentType: LessonContentType.HTML,
      });
    }
  }, 60_000);

  /** The acceptance: the completion still points at the lesson it was made on. */
  it('keeps the completion, pointing at the same row after the retitle', async () => {
    const completions = await db.prisma.kbsLessonCompletion.findMany({ where: { candidateId } });

    expect(completions).toHaveLength(1);
    expect(completions[0].lessonId).toBe(completedLessonId);
  });

  it('and that row is the retitled lesson, not a different one', async () => {
    const lesson = await db.prisma.kbsLesson.findUnique({ where: { id: completedLessonId } });

    expect(lesson?.title).toBe('Troisieme module, retitre par Visquis');
    expect(lesson?.moduleId).toBe(p1ModuleId);
  });

  it('does not silently reset the candidate progress', async () => {
    const progress = await db.prisma.kbsCandidateProgress.findUnique({
      where: { candidateId_moduleId: { candidateId, moduleId: p1ModuleId } },
    });

    expect(progress?.score).toBe(80);
    expect(progress?.passed).toBe(true);
    expect(progress?.attempts).toBe(1);
  });

  it('creates the lesson the revision added', async () => {
    const titles = (await db.prisma.kbsLesson.findMany({ where: { moduleId: p1ModuleId } })).map(
      (l) => l.title,
    );

    expect(titles).toContain('Quatrieme module du parcours un');
  });

  /**
   * Never deleted: the cascade would take the completions with it. Parked above
   * the live band instead, because `@@unique([moduleId, order])` would collide
   * with whichever lesson renumbered into its place.
   */
  it('keeps the lesson the source dropped, parked out of the live order band', async () => {
    const dropped = await db.prisma.kbsLesson.findUnique({ where: { id: p0RemovedLessonId } });

    expect(dropped).not.toBeNull();
    expect(dropped?.order).toBeGreaterThanOrEqual(ORPHAN_ORDER_BASE);
  });

  it('renumbers the surviving P0 lessons into a contiguous band', async () => {
    const live = await db.prisma.kbsLesson.findMany({
      where: { moduleId: p0ModuleId, order: { lt: ORPHAN_ORDER_BASE } },
      orderBy: { order: 'asc' },
    });

    expect(live.map((l) => l.order)).toEqual([1, 2]);
    expect(live.map((l) => l.title)).toEqual([
      'Premier module du parcours zero',
      'Troisieme module du parcours zero',
    ]);
  });

  /** The moved lesson kept its identity, which is what a completion depends on. */
  it('gives the moved P0 lesson its new order without changing its row', async () => {
    const moved = await db.prisma.kbsLesson.findFirst({
      where: { moduleId: p0ModuleId, title: 'Troisieme module du parcours zero' },
    });

    expect(moved?.order).toBe(2);
  });
});
