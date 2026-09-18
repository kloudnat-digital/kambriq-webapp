/**
 * KCA1 replay - run the committed course against a database, and report.
 *
 * Run it:
 *   pnpm tsx --tsconfig tsconfig.base.json prisma/apply-kca1.ts
 *
 * `load-kca1.ts` parses the Drive source and writes `seed-data/kca1.ts`. This
 * applies that committed module to whatever `DATABASE_URL_KBS` points at, and
 * prints what it created, updated, left alone, moved, renamed and could not
 * match. Two scripts because they run in different places: parsing needs the
 * Drive and happens on Visquis's machine; applying needs a database and may
 * happen anywhere.
 *
 * The report is the point as much as the write. Visquis edits the document and
 * has to be able to read the consequences of his own edit - "3 updated" does not
 * tell him whether the lesson he cared about was among them, so every lesson is
 * named.
 *
 * ---------------------------------------------------------------------------
 * What this does NOT do yet, said rather than left to be discovered
 * ---------------------------------------------------------------------------
 * It applies LESSONS. It does not replay the 80 questions: `KbsQuestion` has no
 * stable key either, so matching them is the same two-signal problem over
 * question text, and doing half of it quietly would be worse than not doing it.
 * The questions are seeded once by the course switch; replaying them is its own
 * piece of work.
 *
 * It also does not touch `KbsSettings.activeCourseId`. Switching the course
 * over is step 4, deliberately after this, so that a load can be run and read
 * before anybody is pointed at its result.
 */

/* eslint-disable @nx/enforce-module-boundaries -- a prisma/ script, outside any nx project, like seed.ts */
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as KbsClient } from '../libs/common/src/prisma/kbs-client/client';
import { KCA1_CONTENT_TYPE, KCA1_PARCOURS } from './seed-data/kca1';
import { applyLessons, formatReport, type ApplyResult } from './kca1-apply';

/** The course this loader owns. Matched by title, created if absent. */
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
          // Decision 4: no global total. The duration shown is per module.
          duration: null,
        },
      }));
    console.log(`course  : ${course.id} ${course.title}`);

    const results: ApplyResult[] = [];

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
    }

    console.log('\nKCA1 apply report');
    console.log('=================\n');
    console.log(formatReport(results));

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
