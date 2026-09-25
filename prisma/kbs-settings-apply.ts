/**
 * Ensures the `KbsSettings` row is seeded with an active course without overriding
 * an existing valid selection.
 *
 * Rules:
 * 1. Creation: If the settings row does not exist, it is created with the default `activeCourseId`.
 * 2. Repair: If the row exists but `activeCourseId` is null, it is repaired with the default.
 * 3. Preservation: If `activeCourseId` is already set, it is left intact to respect administrator choices.
 *
 * Concurrency:
 * The null check during repair is executed within the Postgres `WHERE` clause (`updateMany`)
 * to prevent race conditions and ensure atomicity.
 */

/**
 * Structural definition of the Prisma client subset required by this script.
 *
 * Declared structurally to avoid importing the generated client, which is gitignored
 * and excluded from the web image. Method syntax is used over arrow properties to
 * leverage TypeScript's bivariant parameter checking for delegate compatibility.
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
 * Bootstraps the `KbsSettings` configuration.
 * Returns a result object indicating whether the settings were created, repaired, or left intact.
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

  // Atomically repair the row only if `activeCourseId` is null, preventing overwrites of valid courses.
  const repaired = await settings.updateMany({
    where: { id: KBS_SETTINGS_ID, activeCourseId: null },
    data: { activeCourseId: seed.activeCourseId },
  });

  const after = await settings.findUnique({
    where: { id: KBS_SETTINGS_ID },
    select: { activeCourseId: true },
  });

  // Determine the outcome based on the database response count.
  const outcome: KbsSettingsOutcome =
    before === null ? 'created' : repaired.count > 0 ? 'repaired' : 'left-in-place';

  return { outcome, activeCourseId: after?.activeCourseId ?? null };
};

/** Formats the operation result for console output. */
export const describeKbsSettings = (result: KbsSettingsResult): string => {
  if (result.outcome === 'created') {
    return `KBS settings created, active course ${result.activeCourseId}`;
  }
  if (result.outcome === 'repaired') {
    return `KBS settings had no active course - repaired to ${result.activeCourseId}`;
  }
  return `KBS settings left alone, active course stays ${result.activeCourseId}`;
};
