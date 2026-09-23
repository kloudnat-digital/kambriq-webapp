/**
 * Defines the possible content types for KBS lessons.
 *
 * Extracted into a separate module to allow importing into web bundles that compile
 * with `isolatedModules: true`, avoiding compatibility issues with `const enum`
 * exports found in `constants/kbs/index.ts`.
 */

/** The four values a `KbsLesson.contentType` column may hold. */
export const LESSON_CONTENT_TYPES = ['VIDEO', 'PDF', 'HTML', 'TEXT'] as const;

export type KbsLessonContentType = (typeof LESSON_CONTENT_TYPES)[number];

/** Named constants for lesson content types to prevent string typos. */
export const LessonContentType = {
  VIDEO: 'VIDEO',
  PDF: 'PDF',
  HTML: 'HTML',
  TEXT: 'TEXT',
} as const satisfies Record<KbsLessonContentType, KbsLessonContentType>;

/** Defines content types that require signed file URLs (as opposed to inline body text). */
export const FILE_BACKED_CONTENT_TYPES = ['VIDEO', 'PDF'] as const;

export const isFileBackedContentType = (value: string): boolean =>
  (FILE_BACKED_CONTENT_TYPES as readonly string[]).includes(value);

export const isLessonContentType = (value: unknown): value is KbsLessonContentType =>
  typeof value === 'string' && (LESSON_CONTENT_TYPES as readonly string[]).includes(value);
