import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { I18nService } from 'nestjs-i18n';
import { QUEUES } from '@kambriq/common/constants/queue';
import { KbsExamService } from '../../kbs/exam/exam.service';
import { KbsPrismaService } from '../../kbs/prisma/kbs-prisma.service';
import { UsersService } from '../../core/users/users.service';
import { openKbsTestDatabase, type KbsTestDatabase } from './kbs-test-db';

/**
 * I21 - the exploit itself, against the real kbs migrations.
 *
 * `startExam` served a random 20 from the pool and recorded only HOW MANY
 * (`totalQuestions`), not WHICH. `saveAnswer` upserted an answer for any
 * `questionId` in the pool, and `gradeExam` divided every correct saved answer
 * by the 20 served, uncapped. A candidate who knows answers from the pool - from
 * an earlier attempt, from another candidate, or from sequential seeded ids -
 * could answer questions the exam never showed them and turn a fail into a pass
 * over 100%. Since I15 a certificate confers KCA_CERTIFIED and, through KAMNET,
 * AGENT: this was a path from failing the exam to selling land.
 *
 * Nothing here is mocked below the service: real Postgres, real migrations,
 * real constraints. The attack is an ordinary sequence of well-formed requests.
 */
describe('I21 - an exam is answered only on the questions it served', () => {
  const POOL = 60;
  const SERVED = 20;

  let db: KbsTestDatabase;
  let prisma: KbsPrismaService;
  let service: KbsExamService;

  const userId = randomUUID();
  let examId: string;
  const correctAnswerOf = new Map<string, string>();
  const wrongAnswerOf = new Map<string, string>();
  /** The lookups below never miss; a miss is a broken fixture, said loudly. */
  const known = (map: Map<string, string>, id: string): string => {
    const value = map.get(id);
    if (value === undefined) throw new Error(`fixture: no answer recorded for ${id}`);
    return value;
  };

  beforeAll(async () => {
    db = openKbsTestDatabase();
    prisma = new KbsPrismaService({ get: () => db.url } as unknown as ConfigService);

    const module = await Test.createTestingModule({
      providers: [
        KbsExamService,
        { provide: KbsPrismaService, useValue: prisma },
        { provide: getQueueToken(QUEUES.KBS), useValue: { add: jest.fn() } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: UsersService, useValue: {} },
      ],
    }).compile();
    service = module.get(KbsExamService);

    // A test database only (`assertIsTestDatabase`): start from nothing, so the
    // pool is exactly the questions below.
    await prisma.$executeRawUnsafe(
      `TRUNCATE "KbsExamAnswerSelection", "KbsExamAnswer", "KbsExam", "KbsExamQuestionAnswer",
                "KbsExamQuestion", "KbsModule", "KbsCourse", "KbsCandidate", "KbsSettings" CASCADE`,
    );
    await prisma.kbsSettings.create({ data: { examQuestionCount: SERVED } });

    const course = await prisma.kbsCourse.create({
      data: { title: `I21 course ${randomUUID()}`, description: 'I21', isPublished: true },
    });
    const mod = await prisma.kbsModule.create({
      data: { courseId: course.id, title: 'I21 module', description: 'I21', order: 1 },
    });
    for (let n = 0; n < POOL; n++) {
      const q = await prisma.kbsExamQuestion.create({
        data: {
          moduleId: mod.id,
          text: `Question ${n}`,
          type: 'SINGLE',
          answers: {
            create: [
              { text: 'right', isCorrect: true },
              { text: 'wrong 1', isCorrect: false },
              { text: 'wrong 2', isCorrect: false },
              { text: 'wrong 3', isCorrect: false },
            ],
          },
        },
        include: { answers: true },
      });
      for (const a of q.answers) (a.isCorrect ? correctAnswerOf : wrongAnswerOf).set(q.id, a.id);
    }

    const candidate = await prisma.kbsCandidate.create({
      data: { userId, status: 'EXAM_PENDING' },
    });
    const exam = await prisma.kbsExam.create({
      data: {
        candidateId: candidate.id,
        attemptNumber: 1,
        status: 'SCHEDULED',
        scheduledAt: new Date(Date.now() - 60_000),
        durationMinutes: 60,
        passingScore: 75,
      },
    });
    examId = exam.id;
  });

  afterAll(async () => {
    // The service owns its own pg pool; `$disconnect` alone leaves it open.
    await prisma?.onModuleDestroy();
    await db?.close();
  });

  it('refuses every question it did not serve, and cannot be scored above 100', async () => {
    const started = await service.startExam(userId, examId);
    const served = new Set(started.questions.map((q) => q.id));
    expect(served.size).toBe(SERVED);

    // The attack: a correct answer for every question in the pool.
    let refused = 0;
    for (const questionId of correctAnswerOf.keys()) {
      try {
        await service.saveAnswer(userId, examId, {
          questionId,
          answerIds: [known(correctAnswerOf, questionId)],
        });
      } catch (error) {
        if (!(error instanceof BadRequestException)) throw error;
        refused++;
      }
    }

    await service.submitExam(userId, examId, { answers: [] });
    const { score } = await service.gradeExam(examId);

    expect({ refused, score }).toEqual({ refused: POOL - SERVED, score: 100 });
  });

  it('refuses a submission that carries a question it did not serve, and leaves the exam open', async () => {
    const candidateId = (await prisma.kbsCandidate.findUniqueOrThrow({ where: { userId } })).id;
    const third = await prisma.kbsExam.create({
      data: {
        candidateId,
        attemptNumber: 3,
        status: 'SCHEDULED',
        scheduledAt: new Date(Date.now() - 60_000),
        durationMinutes: 60,
      },
    });
    const started = await service.startExam(userId, third.id);
    const served = new Set(started.questions.map((q) => q.id));
    const unserved = [...correctAnswerOf.keys()].find((id) => !served.has(id));
    if (!unserved) throw new Error('fixture: the pool has no unserved question');

    await expect(
      service.submitExam(userId, third.id, {
        answers: [{ questionId: unserved, answerIds: [known(correctAnswerOf, unserved)] }],
      }),
    ).rejects.toThrow(BadRequestException);

    const after = await prisma.kbsExam.findUniqueOrThrow({ where: { id: third.id } });
    expect(after.status).toBe('IN_PROGRESS');
  });

  it('refuses an answer that belongs to another question', async () => {
    const other = await prisma.kbsExam.create({
      data: {
        candidateId: (await prisma.kbsCandidate.findUniqueOrThrow({ where: { userId } })).id,
        attemptNumber: 2,
        status: 'SCHEDULED',
        scheduledAt: new Date(Date.now() - 60_000),
        durationMinutes: 60,
      },
    });
    const started = await service.startExam(userId, other.id);
    const [first, second] = started.questions.map((q) => q.id);

    await expect(
      service.saveAnswer(userId, other.id, {
        questionId: first,
        answerIds: [known(correctAnswerOf, second)],
      }),
    ).rejects.toThrow(BadRequestException);

    // The honest path still works: an answer of the served question itself.
    await expect(
      service.saveAnswer(userId, other.id, {
        questionId: first,
        answerIds: [known(wrongAnswerOf, first)],
      }),
    ).resolves.toBeDefined();
  });
});
