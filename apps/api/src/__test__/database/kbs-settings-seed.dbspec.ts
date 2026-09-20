/* eslint-disable @nx/enforce-module-boundaries -- the seed's settings write lives in prisma/, outside any nx project; this test exists to pin it against a real database */
import { randomUUID } from 'node:crypto';
import {
  KBS_SETTINGS_ID,
  seedKbsSettings,
  type KbsSettingsSeed,
} from '../../../../../prisma/kbs-settings-apply';
import { openKbsTestDatabase, type KbsTestDatabase } from './kbs-test-db';

/**
 * I42 - a seed run must not move an active course somebody chose.
 *
 * The KCA1 switch is one row: `KbsSettings.activeCourseId`. Every candidate
 * path reads it, and since I38 it is also the thing that decides which course
 * a candidate may train in at all. An administrator sets it through
 * `PATCH /kbs/settings`; the seed then reverted it on the next run, and the
 * run went green while doing so.
 *
 * ---------------------------------------------------------------------------
 * Why TWO assertions, and why neither alone is proof
 * ---------------------------------------------------------------------------
 * The two ways of getting this wrong fail in OPPOSITE directions, so a single
 * test passes for the wrong reason whichever one you write:
 *
 *   - `update: { activeCourseId }` - today's code - repairs a null row and
 *     also overwrites a deliberate choice. It PASSES "the null row is
 *     repaired" and fails "the choice survives".
 *   - `update: {}` - the obvious fix, and the one the brief forbids - leaves a
 *     choice alone and also leaves an environment seeded before this column
 *     existed stranded on NULL for ever. It PASSES "the choice survives" and
 *     fails "the null row is repaired".
 *
 * Both were run against this file and both were watched failing on exactly one
 * of the two tests. A fix that never writes and a fix that always writes are
 * each half right, and only the pair of assertions can tell them apart.
 *
 * ---------------------------------------------------------------------------
 * Why the seed is not called
 * ---------------------------------------------------------------------------
 * `prisma/seed.ts` exports nothing: `main()` is private and runs at module
 * load, across all four databases. Importing it here would execute roughly
 * fifteen hundred lines of seeding as an import side effect, against whatever
 * the `DATABASE_URL_*` variables happen to name. So the settings write is
 * extracted into `prisma/kbs-settings-apply.ts` - the split `kca1-apply.ts`
 * already uses - and the seed calls the same function this test calls.
 */
describe('I42 - seeding does not overrule the chosen active course', () => {
  let db: KbsTestDatabase;

  let demonstrationCourseId: string;
  let kca1CourseId: string;
  let seed: KbsSettingsSeed;

  /** What the row says right now, read back rather than inferred from a return. */
  const activeCourse = async (): Promise<string | null> => {
    const row = await db.prisma.kbsSettings.findUnique({
      where: { id: KBS_SETTINGS_ID },
      select: { activeCourseId: true },
    });
    return row?.activeCourseId ?? null;
  };

  beforeAll(async () => {
    db = openKbsTestDatabase();

    await db.prisma.$executeRawUnsafe(
      `TRUNCATE "KbsExamAnswerSelection", "KbsExamAnswer", "KbsExam", "KbsExamQuestionAnswer",
                "KbsExamQuestion", "KbsAnswer", "KbsQuestion", "KbsLessonCompletion",
                "KbsCandidateProgress", "KbsLesson", "KbsModule", "KbsCourse", "KbsCandidate",
                "KbsSettings" CASCADE`,
    );

    /**
     * Two real courses, because the defect is about which of them the row
     * names. With one course "the active course did not move" is true however
     * the code behaves, which is the single-course fixture that let this live.
     */
    const demonstration = await db.prisma.kbsCourse.create({
      data: { title: `Demonstration ${randomUUID()}`, description: 'the seeded course' },
    });
    const kca1 = await db.prisma.kbsCourse.create({
      data: { title: `KCA1 ${randomUUID()}`, description: 'the course that was switched to' },
    });
    demonstrationCourseId = demonstration.id;
    kca1CourseId = kca1.id;

    seed = {
      activeCourseId: demonstrationCourseId,
      examQuestionCount: 20,
      quizQuestionCount: 10,
      quizMaxAttempts: 0,
    };
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  // ----- the first run, which is the only one that may set a policy -----

  it('creates the row carrying the active course when there is none', async () => {
    const result = await seedKbsSettings(db.prisma.kbsSettings, seed);

    expect(result.outcome).toBe('created');
    expect(await activeCourse()).toBe(demonstrationCourseId);
  });

  // ----- assertion one: a choice survives a re-seed -----

  /**
   * The switch, made the way an administrator makes it: the row already exists
   * and names a different course afterwards.
   */
  it('a second run leaves a course somebody switched to alone', async () => {
    await db.prisma.kbsSettings.update({
      where: { id: KBS_SETTINGS_ID },
      data: { activeCourseId: kca1CourseId },
    });

    const result = await seedKbsSettings(db.prisma.kbsSettings, seed);

    expect(await activeCourse()).toBe(kca1CourseId);
    expect(result.outcome).toBe('left-in-place');
  });

  // ----- assertion two: a stranded row is still repaired -----

  /**
   * The state the original line was written for, and the reason `update: {}`
   * is not the fix. An environment seeded before this column existed carries
   * NULL, and a null active course strands every candidate on it.
   */
  it('repairs a row whose active course is null', async () => {
    await db.prisma.kbsSettings.update({
      where: { id: KBS_SETTINGS_ID },
      data: { activeCourseId: null },
    });

    const result = await seedKbsSettings(db.prisma.kbsSettings, seed);

    expect(await activeCourse()).toBe(demonstrationCourseId);
    expect(result.outcome).toBe('repaired');
  });
});
