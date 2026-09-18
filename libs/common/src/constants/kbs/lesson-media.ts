/**
 * The lesson media kinds, written once.
 *
 * A3. The certification document leaves markers where something has still to be
 * produced - a video, an image, a document - and each one becomes a row in
 * `KbsLessonMedia` with a null `url` until the file exists. Three values, and
 * they would otherwise be spelled in three places: the Prisma schema comment,
 * the loader that creates the rows, and whatever reads them.
 *
 * That is the defect `lesson-content.ts` closes one level down, so it is closed
 * the same way here rather than repeated. The schema comment on
 * `KbsLessonMedia.kind` points at this file instead of restating the list, and
 * `lesson-media-one-spelling.spec.ts` fails if it starts restating it.
 *
 * Kept apart from `lesson-content.ts` because they are a different vocabulary:
 * a lesson's `contentType` says how its body is carried, a media kind says what
 * an unfilled slot is waiting for. Merging them would be tidiness, not
 * correctness - and the day one list changes, the other must not move with it.
 */

/** What an unfilled media slot is waiting for. */
export const LESSON_MEDIA_KINDS = ['VIDEO', 'IMAGE', 'DOCUMENT'] as const;

export type KbsLessonMediaKind = (typeof LESSON_MEDIA_KINDS)[number];

/**
 * Named access, so a caller writes `LessonMediaKind.VIDEO` rather than a string.
 * A misspelling is then a compile error instead of a row nothing matches.
 */
export const LessonMediaKind = {
  VIDEO: 'VIDEO',
  IMAGE: 'IMAGE',
  DOCUMENT: 'DOCUMENT',
} as const satisfies Record<KbsLessonMediaKind, KbsLessonMediaKind>;

export const isLessonMediaKind = (value: unknown): value is KbsLessonMediaKind =>
  typeof value === 'string' && (LESSON_MEDIA_KINDS as readonly string[]).includes(value);
