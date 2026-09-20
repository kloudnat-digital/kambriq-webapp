/**
 * I42 - the seed sets the active course, and never moves one somebody chose.
 *
 * `prisma/seed.ts` upserted `KbsSettings` with
 * `update: { activeCourseId: IDS.KBS_COURSE }`, which is two rules welded into
 * one line. One of them is right and the other silently undoes a day of work.
 *
 * ---------------------------------------------------------------------------
 * Why the original line was written, and why it cannot stay
 * ---------------------------------------------------------------------------
 * The reason in the comment above it was honest and is still true: a settings
 * row seeded before `activeCourseId` existed carries NULL, and a null active
 * course is not a cosmetic gap. `checkAndTransitionToExamPending` reads it
 * first and returns early, so a candidate who has passed every module stays
 * IN_TRAINING for ever with nothing logged, and `me/overview` answers
 * `course: null, modulesTotal: 0` to somebody who has just finished six
 * lessons. Both were observed on dev. `update: {}` leaves that environment
 * broken for ever, because idempotent is not restorative.
 *
 * But writing the id UNCONDITIONALLY makes every seed run an act of policy.
 * The active course is a CHOICE - an administrator makes it through
 * `PATCH /kbs/settings`, and the KCA1 switch was exactly that choice. A seed
 * run after it reverts the platform to the demonstration course, and nothing
 * anywhere says so: the run goes green, the settings row looks populated, and
 * the only symptom is every candidate being served the wrong course.
 *
 * The two rules are therefore separated, and each is written as itself:
 *
 *   - a row that does not exist is CREATED carrying the id - the seed is what
 *     brings an environment up, and an environment with no active course is
 *     the stranded state above;
 *   - a row that exists is REPAIRED only where the id is NULL - the case the
 *     original comment was actually about;
 *   - a row that names a course is LEFT ALONE, whichever course it names.
 *
 * ---------------------------------------------------------------------------
 * Why "only when null" is a `where` clause and not an `if`
 * ---------------------------------------------------------------------------
 * The condition is sent to Postgres rather than evaluated here. A read
 * followed by a decision followed by a write is three steps a concurrent run
 * can interleave; `updateMany` with `activeCourseId: null` in its `where` is
 * one statement that cannot repair a row which stopped being null in the
 * meantime. The same reasoning as the append-only triggers: a rule the
 * database holds is not a promise a caller has to keep.
 */

/**
 * The slice of a Prisma client this write needs.
 *
 * Declared structurally, for the reason `kca1-apply.ts` states: nothing in
 * `prisma/` may import the generated client, which is gitignored and absent
 * from the web image. The database test passes the REAL `prisma.kbsSettings`
 * against this type with no cast, so the compiler checks the shape rather than
 * taking it on trust.
 *
 * Method syntax rather than arrow properties on purpose: TypeScript checks
 * method parameters bivariantly, which is what lets a hand-written type accept
 * a delegate whose own argument types are far more generic.
 */
export type SettingsWriter = {
  findUnique(args: {
    where: { id: number };
    select: { activeCourseId: true };
  }): Promise<{ activeCourseId: string | null } | null>;
  upsert(args: {
    where: { id: number };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<unknown>;
  updateMany(args: {
    where: { id: number; activeCourseId: null };
    data: { activeCourseId: string };
  }): Promise<{ count: number }>;
};

/** The settings row is a singleton, and `seed.ts` has always keyed it on 1. */
export const KBS_SETTINGS_ID = 1;

/** What the seed writes when it is the thing creating the row. */
export type KbsSettingsSeed = {
  activeCourseId: string;
  examQuestionCount: number;
  quizQuestionCount: number;
  quizMaxAttempts: number;
};

export type KbsSettingsOutcome = 'created' | 'repaired' | 'left-in-place';

export type KbsSettingsResult = {
  outcome: KbsSettingsOutcome;
  /** The course the row names when the write is done - read back, not assumed. */
  activeCourseId: string | null;
};

/**
 * Brings `KbsSettings` up without overruling a choice somebody made.
 *
 * Returns what it did rather than announcing success, so the seed can print a
 * sentence that is true on all three paths. A mechanism that reports success
 * by saying nothing is the defect this file exists to stop being silent about.
 */
export const seedKbsSettings = async (
  settings: SettingsWriter,
  seed: KbsSettingsSeed,
): Promise<KbsSettingsResult> => {
  const before = await settings.findUnique({
    where: { id: KBS_SETTINGS_ID },
    select: { activeCourseId: true },
  });

  await settings.upsert({
    where: { id: KBS_SETTINGS_ID },
    create: { id: KBS_SETTINGS_ID, ...seed },
    update: {},
  });

  // The repair, and only where nobody has chosen a course. `activeCourseId:
  // null` is part of the `where`, so a row that stopped being null between the
  // read above and this statement is not written over the top of somebody's
  // choice - the condition is held by Postgres rather than by this function
  // remembering to check it.
  const repaired = await settings.updateMany({
    where: { id: KBS_SETTINGS_ID, activeCourseId: null },
    data: { activeCourseId: seed.activeCourseId },
  });

  const after = await settings.findUnique({
    where: { id: KBS_SETTINGS_ID },
    select: { activeCourseId: true },
  });

  // Read from what the database did, not from what was intended: `repaired.count`
  // is the statement's own answer about whether it matched a row.
  const outcome: KbsSettingsOutcome =
    before === null ? 'created' : repaired.count > 0 ? 'repaired' : 'left-in-place';

  return { outcome, activeCourseId: after?.activeCourseId ?? null };
};

/** The decision as a line the seed's output can carry. */
export const describeKbsSettings = (result: KbsSettingsResult): string => {
  if (result.outcome === 'created') {
    return `KBS settings created, active course ${result.activeCourseId}`;
  }
  if (result.outcome === 'repaired') {
    return `KBS settings had no active course - repaired to ${result.activeCourseId}`;
  }
  return `KBS settings left alone, active course stays ${result.activeCourseId}`;
};
