/**
 * Executes the database write operations for the KCA1 course replay.
 *
 * Execution phases:
 * The script processes writes in two phases to avoid `@@unique([moduleId, order])` constraint
 * violations when reordering lessons.
 * - Phase 1: existing rows are temporarily reassigned to an order far outside the standard range.
 * - Phase 2: rows are assigned their final target order.
 *
 * Deletions:
 * To preserve associated `KbsLessonCompletion` records (which cascade on deletion), lessons
 * removed from the source are parked outside the standard ordering band rather than deleted.
 * These are logged as absent from the source in the execution report.
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
 * Structural definition of the Prisma client subset required by this script.
 *
 * Declared structurally to avoid importing the generated client, which is gitignored
 * and excluded from the web image. Method syntax is used over arrow properties to
 * leverage TypeScript's bivariant parameter checking for delegate compatibility.
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

/** Staging threshold used to park rows between ordering phases. */
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

  // Phase 1: Park existing rows above the live band to prevent `@@unique([moduleId, order])` collisions during reordering.
  for (const [index, row] of existing.entries()) {
    await lessons.update({ where: { id: row.id }, data: { order: STAGING_BASE + index + 1 } });
  }

  // Phase 2: Assign final positions. Unmatched source rows are parked rather than deleted to prevent completion cascade deletion.
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
 * Structural definition of the question writer interface.
 * Implemented by both `KbsQuestion` and `KbsExamQuestion` delegates.
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

/** Expected question type indicating a single correct answer. */
const SINGLE_ANSWER = 'SINGLE';

/**
 * Writes the specified questions to both the module quiz (`KbsQuestion`) and exam (`KbsExamQuestion`) pools.
 * Nested creates are utilized to ensure atomic creation of a question and its corresponding answers.
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

/** Formats the question execution summary report. */
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

/** Generates a detailed report of applied changes per lesson to facilitate review. */
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
