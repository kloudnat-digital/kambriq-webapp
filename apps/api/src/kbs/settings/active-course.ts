import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { KbsPrismaService } from '../prisma/kbs-prisma.service';

/**
 * I38 - one reader and one guard for "the candidate's course".
 *
 * ---------------------------------------------------------------------------
 * Why a function taking prisma, and not a method on KbsSettingsService
 * ---------------------------------------------------------------------------
 * The obvious shape was `KbsSettingsService.getActiveCourse()` injected into
 * the four services that read the setting. It was rejected after measuring the
 * cost: those services are constructed with explicit provider lists in about
 * seventeen spec files, and a new constructor dependency makes every one of
 * them fail to INSTANTIATE. A suite that fails to build is not red - it tells
 * you nothing about the code - so the ripple would have hidden any real
 * regression behind seventeen missing-provider errors.
 *
 * Every one of those services already holds `KbsPrismaService`. Passing it in
 * gives the same single implementation with no constructor change and no spec
 * churn. The requirement was one reader and one guard, not a particular
 * injection topology.
 *
 * ---------------------------------------------------------------------------
 * Why absence is an argument rather than a default
 * ---------------------------------------------------------------------------
 * "No active course" means three different things here, and each is deliberate:
 *
 * - the exam draw REFUSES - a draw from "no course in particular" is the
 *   unscoped read I36 exists to prevent;
 * - `getMyOverview` returns an EMPTY overview - I21 established that a missing
 *   settings row is a state, not a 500;
 * - `checkAndTransitionToExamPending` LOGS AND RETURNS - the candidate is
 *   stranded and somebody has to be told.
 *
 * Passing the choice in keeps all three visible at their call sites. A default
 * would make two of them an accident of which service the code lives in, which
 * is how they drifted apart in the first place.
 */
export type AbsentCourse = 'refuse' | 'allow';

/** The settings fields any caller of this module needs, read in one query. */
export type ActiveCourseSettings = {
  activeCourseId: string | null;
  examQuestionCount: number;
  quizQuestionCount: number;
  quizMaxAttempts: number;
  quizCooldownMinutes: number;
};

/**
 * The one place the active course is read.
 *
 * **Returns the row, not just the id.** `examPoolShortfall` and
 * `findModuleDetail` read counts from the same row they read `activeCourseId`
 * from; a reader returning only the id would have forced a second query at
 * those sites, and the next caller would have skipped the helper to avoid it.
 *
 * Read-only and non-creating, unlike `KbsSettingsService.getSettings`: a
 * candidate asking a question must not write a settings row as a side effect.
 */
export const readActiveCourse = async (
  prisma: KbsPrismaService,
): Promise<ActiveCourseSettings | null> =>
  prisma.kbsSettings.findFirst({
    select: {
      activeCourseId: true,
      examQuestionCount: true,
      quizQuestionCount: true,
      quizMaxAttempts: true,
      quizCooldownMinutes: true,
    },
  });

/**
 * Refuses when `courseId` is not the active course.
 *
 * **`NotFoundException`, not `Forbidden`.** A candidate asking for a module of
 * a course they are not enrolled in should not learn that it exists: the answer
 * is the one they would get for an id that is not there at all. The caller
 * supplies the exception so the existing `kbs.module.notFound` /
 * `kbs.lesson.notFound` messages are reused and no new user-facing wording
 * enters the product here.
 *
 * `allow` is for the read-only display paths that have already handled the
 * empty case: with no settings row at all, `findModuleDetail` must still answer
 * with the defaults the quiz itself enforces (I21), rather than start refusing.
 * The three writers use `refuse`, because banking a row against "no course in
 * particular" is the damage this subject exists to stop.
 */
export const assertInActiveCourse = (
  courseId: string | null | undefined,
  activeCourseId: string | null | undefined,
  notFound: () => NotFoundException | ForbiddenException,
  onAbsent: AbsentCourse = 'refuse',
): void => {
  if (!activeCourseId) {
    if (onAbsent === 'allow') return;
    throw notFound();
  }
  if (courseId !== activeCourseId) throw notFound();
};
