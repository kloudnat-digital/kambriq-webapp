/**
 * KCA1 replay - the writes, and the order they have to happen in.
 *
 * `seed-data/kca1-sync.ts` decides what a second load MEANS and touches no
 * database. This file performs it. The split is the same one the loader uses:
 * the decision is unit-tested without Postgres, and the writes are proved
 * against real Postgres and the real migrations in `kca1-replay.dbspec.ts`.
 *
 * ---------------------------------------------------------------------------
 * Why the writes are in two phases
 * ---------------------------------------------------------------------------
 * `KbsLesson` carries `@@unique([moduleId, order])`. A revision that removes a
 * lesson renumbers every lesson after it, so writing the new orders one row at
 * a time walks straight into that constraint: the row moving into order 2 hits
 * the row that has not yet moved out of it. The load would fail half-applied,
 * on a constraint, with no report.
 *
 * So every row that is staying is first parked at a temporary order far above
 * the live band, and only then given its final one. Two passes, no collision,
 * and the same technique parks the rows the source no longer mentions.
 *
 * ---------------------------------------------------------------------------
 * What is never done
 * ---------------------------------------------------------------------------
 * Nothing is deleted. `KbsLessonCompletion.lesson` cascades, so deleting a
 * lesson destroys completions a candidate earned. A lesson that leaves the
 * source keeps its row, keeps its completions, is parked out of the live band
 * and is named in the report as absent from the source.
 */

import {
  ORPHAN_ORDER_BASE,
  decideQuestionLoad,
  describeQuestionDecision,
  matchLessons,
  orphanOrder,
  summarise,
  type ExistingLesson,
  type LessonMatch,
  type MatchOutcome,
  type QuestionLoadDecision,
  type SourceLesson,
  type SourceQuestion,
} from './seed-data/kca1-sync';

/**
 * The slice of a Prisma client these writes need.
 *
 * Declared here, structurally, so this file imports nothing generated - the
 * generated client is gitignored and absent from the web image, and a prisma/
 * script that depended on it would repeat the break that took the web image
 * down. The database test passes the REAL `prisma.kbsLesson` against this type
 * with no cast, so the shape is checked by the compiler rather than assumed.
 *
 * Method syntax rather than arrow properties on purpose: TypeScript checks
 * method parameters bivariantly, which is what lets a hand-written structural
 * type accept a delegate whose own argument types are far more generic.
 */
export type LessonWriter = {
  findMany(args: {
    where: { moduleId: string };
    select: { id: true; title: true; order: true; duration: true; content: true };
  }): Promise<ExistingLesson[]>;
  create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<{ id: string }>;
};

export type ApplyResult = {
  parcours: string;
  matches: LessonMatch[];
};

/** Where staying rows are parked between the two phases. Above every live order. */
const STAGING_BASE = ORPHAN_ORDER_BASE * 2;

export const applyLessons = async (
  lessons: LessonWriter,
  args: { moduleId: string; parcours: string; source: SourceLesson[]; contentType: string },
): Promise<ApplyResult> => {
  const { moduleId, parcours, source, contentType } = args;

  const existing = await lessons.findMany({
    where: { moduleId },
    select: { id: true, title: true, order: true, duration: true, content: true },
  });

  const matches = matchLessons(source, existing);

  // Phase 1. Every row that already exists is parked above the live band, so
  // the final orders below cannot collide with a row that has not moved yet.
  // Without this the second load dies on @@unique([moduleId, order]), half
  // applied, with no report of what it managed to do.
  for (const [index, row] of existing.entries()) {
    await lessons.update({ where: { id: row.id }, data: { order: STAGING_BASE + index + 1 } });
  }

  // Phase 2. Final positions, and the rows the source no longer mentions are
  // parked rather than deleted - the cascade on completions is why.
  let orphans = 0;
  for (const match of matches) {
    if (match.source === null) {
      if (match.existingId === null) continue;
      await lessons.update({
        where: { id: match.existingId },
        data: { order: orphanOrder(orphans) },
      });
      orphans += 1;
      continue;
    }

    const data = {
      title: match.source.title,
      contentType,
      content: match.source.contentHtml,
      duration: match.source.durationMinutes,
      order: match.source.moduleNumber,
    };

    if (match.existingId === null) {
      await lessons.create({ data: { moduleId, ...data } });
    } else {
      await lessons.update({ where: { id: match.existingId }, data });
    }
  }

  return { parcours, matches };
};

/**
 * The slice of a question delegate these writes need, declared structurally for
 * the same reason `LessonWriter` is: a `prisma/` script imports nothing
 * generated. `KbsQuestion` and `KbsExamQuestion` both satisfy it, which is what
 * lets one function write both copies.
 */
export type QuestionWriter = {
  findMany(args: {
    where: { moduleId: string };
    select: { id: true; text: true };
  }): Promise<Array<{ id: string; text: string }>>;
  create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
};

export type QuestionApplyResult = {
  parcours: string;
  decision: QuestionLoadDecision;
  created: { quiz: number; quizAnswers: number; exam: number; examAnswers: number };
};

/**
 * The only question type KCA1 carries. Every source question has exactly one
 * correct answer among four, which is what `SINGLE` means to `submitQuiz` and
 * to `gradeExam`; the other spelling of this value is the DTO's
 * `z.enum(['SINGLE', 'MULTIPLE'])`, and there is no shared constant to import.
 */
const SINGLE_ANSWER = 'SINGLE';

/**
 * Writes the eighty questions twice, because the schema holds them twice.
 *
 * `KbsQuestion` feeds the module quiz and `KbsExamQuestion` feeds the exam, and
 * decision 2.1 says both are drawn from the SAME eighty for V0. Writing only
 * the first copy passes every quiz test and leaves I36's course-scoped exam
 * draw looking at an empty pool - a candidate eligible for an exam that answers
 * 503.
 *
 * The answers ride in as a nested create, so a question and its four answers
 * arrive in one statement: a question that exists with no correct answer is one
 * nobody can pass, and I21 is the record of where that leads.
 */
export const applyQuestions = async (
  quiz: QuestionWriter,
  exam: QuestionWriter,
  args: { moduleId: string; parcours: string; source: SourceQuestion[] },
): Promise<QuestionApplyResult> => {
  const { moduleId, parcours, source } = args;

  const [existingQuiz, existingExam] = await Promise.all([
    quiz.findMany({ where: { moduleId }, select: { id: true, text: true } }),
    exam.findMany({ where: { moduleId }, select: { id: true, text: true } }),
  ]);

  const decision = decideQuestionLoad({
    existingQuiz: existingQuiz.length,
    existingExam: existingExam.length,
    sourceQuestions: source.length,
  });

  const created = { quiz: 0, quizAnswers: 0, exam: 0, examAnswers: 0 };

  if (decision.outcome === 'left-untouched') {
    return { parcours, decision, created };
  }

  for (const question of source) {
    const data = {
      moduleId,
      text: question.text,
      type: SINGLE_ANSWER,
      answers: {
        create: question.answers.map((answer) => ({
          text: answer.text,
          isCorrect: answer.isCorrect,
        })),
      },
    };

    await quiz.create({ data });
    created.quiz += 1;
    created.quizAnswers += question.answers.length;

    await exam.create({ data });
    created.exam += 1;
    created.examAnswers += question.answers.length;
  }

  return { parcours, decision, created };
};

/** The question half of the run report, one line per parcours. */
export const formatQuestionReport = (results: QuestionApplyResult[]): string =>
  results
    .map((result) => `${result.parcours}: ${describeQuestionDecision(result.decision)}`)
    .join('\n');

const OUTCOME_ORDER: MatchOutcome[] = [
  'created',
  'updated',
  'moved',
  'renamed',
  'unchanged',
  'absent-from-source',
];

/**
 * Printed so Visquis can read the consequences of his own edit.
 *
 * Every lesson is named, not just counted: "3 updated" does not tell somebody
 * whether the one they cared about was among them, and "absent from the source"
 * is a decision he has to take per lesson rather than in aggregate.
 */
export const formatReport = (results: ApplyResult[]): string => {
  const lines: string[] = [];

  for (const result of results) {
    const counts = summarise(result.matches);
    lines.push(
      `${result.parcours}: ` +
        OUTCOME_ORDER.map((outcome) => `${outcome} ${counts[outcome]}`).join(', '),
    );

    for (const outcome of OUTCOME_ORDER) {
      for (const match of result.matches.filter((m) => m.outcome === outcome)) {
        const name = match.source?.title ?? `(row ${match.existingId ?? 'unknown'})`;
        const by = match.matchedBy === null ? '' : ` matched by ${match.matchedBy}`;
        const changed = match.changes.length === 0 ? '' : ` [${match.changes.join(', ')}]`;
        lines.push(`   ${outcome.padEnd(19)} ${name}${by}${changed}`);
      }
    }
  }

  return lines.join('\n');
};

export { STAGING_BASE, matchLessons, orphanOrder };
