/**
 * Media slot expectations for KBS lessons.
 * Distinct from content types: defines expected asset types rather than main body formats.
 */

/** Expected asset type for an unfilled media slot. */
export const LESSON_MEDIA_KINDS = ['VIDEO', 'IMAGE', 'DOCUMENT'] as const;

export type KbsLessonMediaKind = (typeof LESSON_MEDIA_KINDS)[number];

/** Lesson media kind constants. */
export const LessonMediaKind = {
  VIDEO: 'VIDEO',
  IMAGE: 'IMAGE',
  DOCUMENT: 'DOCUMENT',
} as const satisfies Record<KbsLessonMediaKind, KbsLessonMediaKind>;

export const isLessonMediaKind = (value: unknown): value is KbsLessonMediaKind =>
  typeof value === 'string' && (LESSON_MEDIA_KINDS as readonly string[]).includes(value);
