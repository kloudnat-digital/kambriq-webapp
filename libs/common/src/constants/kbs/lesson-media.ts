/**
 * Defines the possible media kinds for KBS lessons.
 *
 * Separated from lesson content types as they represent a different domain concept:
 * media kinds define what type of asset an unfilled media slot is expecting,
 * whereas content types define the format of the lesson's main body.
 */

/** What an unfilled media slot is waiting for. */
export const LESSON_MEDIA_KINDS = ['VIDEO', 'IMAGE', 'DOCUMENT'] as const;

export type KbsLessonMediaKind = (typeof LESSON_MEDIA_KINDS)[number];

/** Named constants for lesson media kinds to prevent string typos. */
export const LessonMediaKind = {
  VIDEO: 'VIDEO',
  IMAGE: 'IMAGE',
  DOCUMENT: 'DOCUMENT',
} as const satisfies Record<KbsLessonMediaKind, KbsLessonMediaKind>;

export const isLessonMediaKind = (value: unknown): value is KbsLessonMediaKind =>
  typeof value === 'string' && (LESSON_MEDIA_KINDS as readonly string[]).includes(value);
