import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { I18nService } from 'nestjs-i18n';
import { QUEUES } from '@kambriq/common/constants/queue';
import { EXAM_PASSING_SCORE } from '@kambriq/common/constants/kbs';
import { KbsExamService } from '../../kbs/exam/exam.service';
import { KbsPrismaService } from '../../kbs/prisma/kbs-prisma.service';
import { UsersService } from '../../core/users/users.service';
import { openKbsTestDatabase, type KbsTestDatabase } from './kbs-test-db';

/**
 * I36 - an exam draws only from the course the candidate is studying.
 *
 * `ensureQuestionPoolAvailable` counted `kbsExamQuestion` with no course filter,
 * and `startExam` drew from `findMany()` across every exam question in the
 * database. With one course that is invisible. With two it is the defect: on
 * dev, 60 exam questions hang off the demonstration course, so pointing
 * `activeCourseId` at KCA1 would have examined KCA1 candidates on demonstration
 * material - and every mechanical step would have passed. A green end-to-end run
 * proving the engine while the candidate is examined on a course they never
 * studied is the false-witness shape, and it is I21 returning: a certificate
 * that certifies nothing.
 *
 * TWO COURSES COEXIST HERE ON PURPOSE. A single-course fixture is what let this
 * survive - `exam-integrity.dbspec.ts` truncates and builds exactly one, so the
 * unfiltered draw could not be wrong there.
 *
 * The pools are sized so the assertion cannot pass by luck. The draw is 20; the
 * active course holds exactly 20 and the other holds 40. Against the unfiltered
 * code an all-active draw would have to pick the 20 active questions out of 60,
 * which is roughly one chance in 10^15. And the assertion is on PROVENANCE -
 * every served question belongs to the active course's module - not on a count,
 * because two pools of equal size would be equal for the wrong reason.
 */
describe('I36 - an exam is drawn from the active course only', () => {
  const SERVED = 20;
  const ACTIVE_POOL = 20;
  const OTHER_POOL = 40;

  let db: KbsTestDatabase;
  let prisma: KbsPrismaService;
  let service: KbsExamService;

  const userId = randomUUID();
  let activeModuleId: string;
  let otherModuleId: string;
  let examId: string;

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

    await prisma.$executeRawUnsafe(
      `TRUNCATE "KbsExamAnswerSelection", "KbsExamAnswer", "KbsExam", "KbsExamQuestionAnswer",
                "KbsExamQuestion", "KbsLessonCompletion", "KbsCandidateProgress", "KbsLesson",
                "KbsModule", "KbsCourse", "KbsCandidate", "KbsSettings" CASCADE`,
    );

    const makeCourse = async (title: string, pool: number, tag: string) => {
      const course = await prisma.kbsCourse.create({
        data: { title: `${title} ${randomUUID()}`, description: title, isPublished: true },
      });
      const mod = await prisma.kbsModule.create({
        data: { courseId: course.id, title: `${tag} module`, description: tag, order: 1 },
      });
      for (let n = 0; n < pool; n++) {
        await prisma.kbsExamQuestion.create({
          data: {
            moduleId: mod.id,
            // The text carries its course, so a served question can be attributed
            // without joining anything back.
            text: `${tag} question ${n}`,
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
        });
      }
      return { courseId: course.id, moduleId: mod.id };
    };

    const active = await makeCourse('KCA1 active', ACTIVE_POOL, 'ACTIVE');
    const other = await makeCourse('Demonstration', OTHER_POOL, 'OTHER');
    activeModuleId = active.moduleId;
    otherModuleId = other.moduleId;

    await prisma.kbsSettings.create({
      data: { examQuestionCount: SERVED, activeCourseId: active.courseId },
    });

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
        passingScore: EXAM_PASSING_SCORE,
      },
    });
    examId = exam.id;
  }, 60_000);

  afterAll(async () => {
    await prisma?.onModuleDestroy();
    await db?.close();
  });

  it('has two courses in the database, with pools that discriminate', async () => {
    const active = await prisma.kbsExamQuestion.count({ where: { moduleId: activeModuleId } });
    const other = await prisma.kbsExamQuestion.count({ where: { moduleId: otherModuleId } });
    const all = await prisma.kbsExamQuestion.count();

    // Without this the test could pass against a database holding one course.
    expect(active).toBe(ACTIVE_POOL);
    expect(other).toBe(OTHER_POOL);
    expect(all).toBe(ACTIVE_POOL + OTHER_POOL);
  });

  /** The acceptance. Provenance, not counts. */
  it('serves no question from the course the candidate is not studying', async () => {
    const started = await service.startExam(userId, examId);

    expect(started.questions).toHaveLength(SERVED);
    for (const question of started.questions) {
      expect(question.module.id).toBe(activeModuleId);
    }
    expect(started.questions.every((q) => q.text.startsWith('ACTIVE'))).toBe(true);
  });

  /**
   * The count is the other half. A pool of 20 active questions is exactly enough
   * for a draw of 20; an unfiltered count of 60 would say "plenty" even when the
   * active course held far too few, and the draw would then quietly shrink - the
   * defect the pool guard exists to prevent, reintroduced by counting the wrong
   * rows.
   */
  it('counts only the active course when deciding the pool is deep enough', async () => {
    // Take the active course below the draw while the database still holds 40
    // questions in total, which is more than enough by the old reckoning.
    const doomed = await prisma.kbsExamQuestion.findFirst({
      where: { moduleId: activeModuleId },
      select: { id: true },
    });
    if (!doomed) throw new Error('fixture: the active pool is empty');
    await prisma.kbsExamQuestion.delete({ where: { id: doomed.id } });

    const candidateId = (await prisma.kbsCandidate.findUniqueOrThrow({ where: { userId } })).id;
    const second = await prisma.kbsExam.create({
      data: {
        candidateId,
        attemptNumber: 2,
        status: 'SCHEDULED',
        scheduledAt: new Date(Date.now() - 60_000),
        durationMinutes: 60,
        passingScore: EXAM_PASSING_SCORE,
      },
    });

    const total = await prisma.kbsExamQuestion.count();
    expect(total).toBeGreaterThan(SERVED); // 59 in the database, 19 that count

    await expect(service.startExam(userId, second.id)).rejects.toThrow(/pool 19, requis 20/);
  });
});
