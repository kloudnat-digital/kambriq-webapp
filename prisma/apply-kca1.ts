/**
 * Applies the generated KCA1 course data against the target database and generates a report.
 *
 * Execution:
 *   pnpm tsx --tsconfig tsconfig.base.json prisma/apply-kca1.ts
 *
 * This script consumes the output of `load-kca1.ts` (located at `seed-data/kca1.ts`)
 * and applies it to the database specified by `DATABASE_URL_KBS`. The process logs
 * detailed outcomes for created, updated, unchanged, moved, renamed, and unmatched entities.
 *
 * Limitations and behavior:
 * - Lessons are applied on every execution.
 * - Questions are created only once. Subsequent executions will count existing questions
 *   and report them without applying modifications, as questions currently lack a stable
 *   identifier for safe upserts.
 * - This script does not update `KbsSettings.activeCourseId`. Course activation
 *   must be performed as a separate, subsequent step.
 */

/* eslint-disable @nx/enforce-module-boundaries -- Prisma script, located outside NX projects. */
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as KbsClient } from '../libs/common/src/prisma/kbs-client/client';
import { KCA1_CONTENT_TYPE, KCA1_PARCOURS, KCA1_QUESTIONS } from './seed-data/kca1';
import {
  applyLessons,
  applyQuestions,
  formatQuestionReport,
  formatReport,
  type ApplyResult,
  type QuestionApplyResult,
} from './kca1-apply';

/** The course managed by this loader. It is matched by title and created if it does not exist. */
const COURSE_TITLE = 'KCA 1 - Fondations';

const main = async () => {
  const url = process.env['DATABASE_URL_KBS'];
  if (!url) {
    throw new Error('DATABASE_URL_KBS is not set, so there is no database to apply to');
  }

  const pool = new Pool({ connectionString: url });
  const prisma = new KbsClient({ adapter: new PrismaPg(pool) });

  try {
    const target = new URL(url);
    console.log(`database: ${target.host}${target.pathname}`);

    const course =
      (await prisma.kbsCourse.findFirst({ where: { title: COURSE_TITLE } })) ??
      (await prisma.kbsCourse.create({
        data: {
          title: COURSE_TITLE,
          description: 'Parcours 0, 1, 2 et 5 - comprendre, aligner, proteger.',
          language: 'fr',
          isPublished: false,
          // The duration is calculated per module; there is no global duration total.
          duration: null,
        },
      }));
    console.log(`course  : ${course.id} ${course.title}`);

    const results: ApplyResult[] = [];
    const questionResults: QuestionApplyResult[] = [];

    for (const parcours of KCA1_PARCOURS) {
      const existing = await prisma.kbsModule.findFirst({
        where: { courseId: course.id, order: parcours.order },
      });

      const description = [parcours.subtitle, ...parcours.objectives].join(' ');
      const mod = existing
        ? await prisma.kbsModule.update({
            where: { id: existing.id },
            data: { title: `${parcours.code} - ${parcours.title}`, description },
          })
        : await prisma.kbsModule.create({
            data: {
              courseId: course.id,
              title: `${parcours.code} - ${parcours.title}`,
              description,
              order: parcours.order,
            },
          });

      results.push(
        await applyLessons(prisma.kbsLesson, {
          moduleId: mod.id,
          parcours: parcours.code,
          source: parcours.lessons.map((lesson) => ({
            key: lesson.key,
            moduleNumber: lesson.moduleNumber,
            title: lesson.title,
            goal: lesson.goal,
            durationMinutes: lesson.durationMinutes,
            contentHtml: lesson.contentHtml,
          })),
          contentType: KCA1_CONTENT_TYPE,
        }),
      );

      // Ensure that every parcours contains questions to prevent creating modules
      // with empty question pools for exams.
      const source = KCA1_QUESTIONS.filter((question) => question.parcours === parcours.code);
      if (source.length === 0) {
        throw new Error(
          `REFUSED - ${parcours.code} carries no questions in the generated course. ` +
            `Re-run prisma/load-kca1.ts against the source before applying.`,
        );
      }

      questionResults.push(
        await applyQuestions(prisma.kbsQuestion, prisma.kbsExamQuestion, {
          moduleId: mod.id,
          parcours: parcours.code,
          source: source.map((question) => ({
            text: question.text,
            answers: question.answers,
          })),
        }),
      );
    }

    console.log('\nKCA1 apply report');
    console.log('=================\n');
    console.log(formatReport(results));

    console.log('\nQuestions');
    console.log('---------\n');
    console.log(formatQuestionReport(questionResults));

    const absent = results.flatMap((r) =>
      r.matches.filter((m) => m.outcome === 'absent-from-source'),
    );
    if (absent.length > 0) {
      console.log(
        `\n${absent.length} lesson(s) are in the database and absent from the source. They are ` +
          `kept, with their completions, parked out of the live ordering band. Deleting one ` +
          `would cascade to the completions a candidate earned, so that is a decision per ` +
          `lesson rather than a default.`,
      );
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
