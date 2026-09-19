/* eslint-disable @nx/enforce-module-boundaries -- the apply lives in prisma/, outside any nx project; this test exists to pin it against a real database */
import { randomUUID } from 'node:crypto';
import { applyQuestions } from '../../../../../prisma/kca1-apply';
import { openKbsTestDatabase, type KbsTestDatabase } from './kbs-test-db';

/**
 * Step 4 - the question pool a KCA1 candidate is drilled and examined from.
 *
 * Two copies, because the schema has two tables and the exam draws from its
 * own: `KbsQuestion` + `KbsAnswer` for the module quiz, `KbsExamQuestion` +
 * `KbsExamQuestionAnswer` for the exam. Decision 2.1 says the exam draws from
 * the SAME eighty the quizzes drill from, and the only way to say that in this
 * schema is to write the eighty twice. Without the second copy, I36's
 * course-scoped draw finds an empty pool and every candidate meets a 503 on an
 * exam they are otherwise eligible for.
 *
 * Nothing is mocked: real Postgres, real migrations, the real cascade from a
 * question to its answers.
 */
const SOURCE = Array.from({ length: 20 }, (_, i) => ({
  text: `Question ${i + 1} du parcours de preuve`,
  answers: [
    { text: `Reponse A${i + 1}`, isCorrect: i % 4 === 0 },
    { text: `Reponse B${i + 1}`, isCorrect: i % 4 === 1 },
    { text: `Reponse C${i + 1}`, isCorrect: i % 4 === 2 },
    { text: `Reponse D${i + 1}`, isCorrect: i % 4 === 3 },
  ],
}));

describe('KCA1 question load - against real Postgres', () => {
  let db: KbsTestDatabase;
  const courseId = randomUUID();
  const moduleId = randomUUID();

  /** Captured after the first load, compared after the second. */
  let firstLoadQuestionIds: string[];

  beforeAll(async () => {
    db = openKbsTestDatabase();

    await db.prisma.kbsCourse.create({
      data: { id: courseId, title: `Questions ${courseId}`, description: 'question fixture' },
    });
    await db.prisma.kbsModule.create({
      data: { id: moduleId, courseId, title: 'P0', description: 'parcours zero', order: 1 },
    });
  }, 60_000);

  afterAll(async () => {
    await db.prisma.kbsCourse.deleteMany({ where: { id: courseId } });
    await db.close();
  });

  it('writes both copies on a first load, and says it created them', async () => {
    const result = await applyQuestions(db.prisma.kbsQuestion, db.prisma.kbsExamQuestion, {
      moduleId,
      parcours: 'P0',
      source: SOURCE,
    });

    expect(result.decision.outcome).toBe('created');
    expect(result.created).toEqual({ quiz: 20, quizAnswers: 80, exam: 20, examAnswers: 80 });
  }, 60_000);

  it('put twenty quiz questions and eighty answers under the module', async () => {
    const questions = await db.prisma.kbsQuestion.findMany({
      where: { moduleId },
      include: { answers: true },
    });
    firstLoadQuestionIds = questions.map((q) => q.id).sort();

    expect(questions).toHaveLength(20);
    expect(questions.flatMap((q) => q.answers)).toHaveLength(80);
  });

  /**
   * The copy I36's scoped draw actually reads. A pool that exists only as
   * `KbsQuestion` passes every quiz assertion and leaves the exam empty.
   */
  it('put twenty exam questions and eighty exam answers under the same module', async () => {
    const questions = await db.prisma.kbsExamQuestion.findMany({
      where: { moduleId },
      include: { answers: true },
    });

    expect(questions).toHaveLength(20);
    expect(questions.flatMap((q) => q.answers)).toHaveLength(80);
  });

  it('gives every question exactly one correct answer, in both copies', async () => {
    const quiz = await db.prisma.kbsQuestion.findMany({
      where: { moduleId },
      include: { answers: true },
    });
    const exam = await db.prisma.kbsExamQuestion.findMany({
      where: { moduleId },
      include: { answers: true },
    });

    for (const question of [...quiz, ...exam]) {
      expect(question.answers.filter((a) => a.isCorrect)).toHaveLength(1);
    }
  });

  /** A question with no correct answer is a question nobody can pass (I21). */
  it('carries the same texts in both copies, so the exam drills what the quiz taught', async () => {
    const quiz = (await db.prisma.kbsQuestion.findMany({ where: { moduleId } }))
      .map((q) => q.text)
      .sort();
    const exam = (await db.prisma.kbsExamQuestion.findMany({ where: { moduleId } }))
      .map((q) => q.text)
      .sort();

    expect(exam).toEqual(quiz);
  });

  it('leaves everything untouched on a second load, and reports why', async () => {
    const result = await applyQuestions(db.prisma.kbsQuestion, db.prisma.kbsExamQuestion, {
      moduleId,
      parcours: 'P0',
      source: SOURCE,
    });

    expect(result.decision.outcome).toBe('left-untouched');
    expect(result.created).toEqual({ quiz: 0, quizAnswers: 0, exam: 0, examAnswers: 0 });
  }, 60_000);

  /**
   * Counts alone would pass over a pool that had been deleted and rewritten -
   * twenty before and twenty after, different rows. The identity is the
   * assertion, because a rewritten question id is a broken `KbsExamAnswer`.
   */
  it('kept the very same rows, not merely the same number of them', async () => {
    const after = (await db.prisma.kbsQuestion.findMany({ where: { moduleId } }))
      .map((q) => q.id)
      .sort();

    expect(after).toEqual(firstLoadQuestionIds);
  });

  it('did not double the pool', async () => {
    expect(await db.prisma.kbsQuestion.count({ where: { moduleId } })).toBe(20);
    expect(await db.prisma.kbsExamQuestion.count({ where: { moduleId } })).toBe(20);
  });
});
