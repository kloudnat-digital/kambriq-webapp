/**
 * The lesson content types, written once.
 *
 * ---------------------------------------------------------------------------
 * The defect this file closes
 * ---------------------------------------------------------------------------
 * `prisma/seed.ts` wrote `'video'`, `'pdf'`, `'html'` in lower case. Every
 * reader compared upper case: `courses.service.ts` gates the signed URL on
 * `contentType === 'VIDEO' || 'PDF'`, the DTO enum is
 * `['VIDEO','PDF','HTML','TEXT']`, and `kbs-lesson-view.tsx` tests `'HTML'`
 * before rendering a body.
 *
 * Nothing matched. `LessonBody` fell through every branch to its final
 * `return <p>-</p>`, so **all six seeded lessons on dev rendered a single dash
 * and no body at all**, and no `contentUrl` was ever signed. The screens
 * navigated correctly the whole time, which is why it read as working.
 *
 * This is `where: { code: 'client' }` against a stored `'CLIENT'` recurring -
 * the entry in CLAUDE.md that cost a client their portal access. **The casing
 * was how it surfaced; the second spelling was the defect.** So the values are
 * declared here and nowhere else, and the DTO, the service, the web view, the
 * admin editor, the loader and the seed all read them from here.
 *
 * ---------------------------------------------------------------------------
 * Why this is its own module and not part of `constants/kbs/index.ts`
 * ---------------------------------------------------------------------------
 * That index declares `export const enum CandidateStatus` and
 * `export const enum ExamStatus`, and `apps/web` compiles with
 * `isolatedModules: true`. `pnpm typecheck:web` accepts importing it today - I
 * checked, rather than assuming - so this is not a demonstrated break. But no
 * web file imports that index at present, the bundler is the half no local gate
 * covers (A35), and the generated-Prisma-client incident is exactly the shape
 * where every local gate stayed green and only the image failed.
 *
 * A separate module of plain `const` values costs nothing and cannot carry that
 * risk, which is the same reasoning that put the KAMNET enums in their own
 * `enums.ts`. The web imports this subpath directly; the index re-exports it for
 * the API.
 */

/** The four values a `KbsLesson.contentType` column may hold. */
export const LESSON_CONTENT_TYPES = ['VIDEO', 'PDF', 'HTML', 'TEXT'] as const;

export type KbsLessonContentType = (typeof LESSON_CONTENT_TYPES)[number];

/**
 * Named access, so a caller writes `LessonContentType.VIDEO` rather than a
 * string. A misspelling is then a compile error instead of a row nothing reads.
 */
export const LessonContentType = {
  VIDEO: 'VIDEO',
  PDF: 'PDF',
  HTML: 'HTML',
  TEXT: 'TEXT',
} as const satisfies Record<KbsLessonContentType, KbsLessonContentType>;

/**
 * The types whose content is a file behind a signed URL, as opposed to an
 * inline body. `courses.service.ts` signs `contentUrl` for exactly these.
 */
export const FILE_BACKED_CONTENT_TYPES = ['VIDEO', 'PDF'] as const;

export const isFileBackedContentType = (value: string): boolean =>
  (FILE_BACKED_CONTENT_TYPES as readonly string[]).includes(value);

export const isLessonContentType = (value: unknown): value is KbsLessonContentType =>
  typeof value === 'string' && (LESSON_CONTENT_TYPES as readonly string[]).includes(value);
