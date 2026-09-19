import { randomUUID } from 'node:crypto';
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
 * Eligibility counts the modules of the ACTIVE course, on both sides.
 *
 * I36 scoped the exam DRAW to the active course and named this line as the one
 * left unfixed beside it. The KCA1 switch is what made it bite: on dev the
 * database holds six modules - four KCA1 parcours and two demonstration ones -
 * so a candidate who had passed all four KCA1 quizzes was told
 * "Formation incomplete : 4/6 modules termines" and could never sit the exam.
 * Training worked, certification was unreachable, and nothing was broken enough
 * to look broken.
 *
 * BOTH counts were unscoped, and they fail in opposite directions, so they are
 * pinned by two separate tests rather than two tails on one:
 *
 *   - `kbsModule.count()` with no filter inflates the denominator, which
 *     refuses a candidate who has genuinely finished;
 *   - `kbsCandidateProgress.count()` with no filter inflates the numerator,
 *     which would admit a candidate to a KCA1 exam on the strength of modules
 *     passed in a course they are no longer studying.
 *
 * The correct shape already exists in `candidates.service.ts`, where
 * `checkAndTransitionToExamPending` filters both sides by `activeCourseId`.
 * This makes the two agree.
 *
 * TWO COURSES COEXIST HERE ON PURPOSE, with DIFFERENT module counts, so neither
 * assertion can pass by the two numbers happening to be equal.
 */
describe('eligibility counts the active course only', () => {
  const ACTIVE_MODULES = 4;
  const OTHER_MODULES = 2;
  const EXAM_POOL = 20;

  let db: KbsTestDatabase;
  let prisma: KbsPrismaService;
  let service: KbsExamService;

  const finisherUserId = randomUUID();
  const halfFinisherUserId = randomUUID();
  let activeModuleIds: string[] = [];
  let otherModuleIds: string[] = [];

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

    const makeCourse = async (title: string, moduleCount: number, withPool: boolean) => {
      const course = await prisma.kbsCourse.create({
        data: { title: `${title} ${randomUUID()}`, description: title, isPublished: true },
      });
      const moduleIds: string[] = [];
      for (let n = 0; n < moduleCount; n++) {
        const mod = await prisma.kbsModule.create({
          data: {
            courseId: course.id,
            title: `${title} module ${n}`,
            description: title,
            order: n + 1,
          },
        });
        moduleIds.push(mod.id);
      }
      // Only the active course needs a pool deep enough to sit an exam: the
      // shortfall is checked before the module count, and a shallow pool would
      // mask what this file is about.
      if (withPool) {
        for (let n = 0; n < EXAM_POOL; n++) {
          await prisma.kbsExamQuestion.create({
            data: {
              moduleId: moduleIds[0],
              text: `${title} question ${n}`,
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
      }
      return { courseId: course.id, moduleIds };
    };

    const active = await makeCourse('KCA1 active', ACTIVE_MODULES, true);
    const other = await makeCourse('Demonstration', OTHER_MODULES, false);
    activeModuleIds = active.moduleIds;
    otherModuleIds = other.moduleIds;

    await prisma.kbsSettings.create({
      data: { examQuestionCount: EXAM_POOL, activeCourseId: active.courseId },
    });

    // The finisher has passed every module of the course they are studying.
    const finisher = await prisma.kbsCandidate.create({
      data: { userId: finisherUserId, status: 'EXAM_PENDING' },
    });
    for (const moduleId of activeModuleIds) {
      await prisma.kbsCandidateProgress.create({
        data: { candidateId: finisher.id, moduleId, score: 100, passed: true, attempts: 1 },
      });
    }

    // The half-finisher has passed HALF the active course and made up the
    // difference in the other one: 2 active + 2 demonstration = 4 passed rows,
    // which is exactly the active course's module count. See the test below for
    // what that number is chosen to catch.
    const halfFinisher = await prisma.kbsCandidate.create({
      data: { userId: halfFinisherUserId, status: 'EXAM_PENDING' },
    });
    for (const moduleId of [...activeModuleIds.slice(0, 2), ...otherModuleIds]) {
      await prisma.kbsCandidateProgress.create({
        data: { candidateId: halfFinisher.id, moduleId, score: 100, passed: true, attempts: 1 },
      });
    }
  }, 60_000);

  afterAll(async () => {
    await prisma?.onModuleDestroy();
    await db?.close();
  });

  it('has two courses with different module counts, so neither side can match by luck', async () => {
    const all = await prisma.kbsModule.count();

    expect(activeModuleIds).toHaveLength(ACTIVE_MODULES);
    expect(otherModuleIds).toHaveLength(OTHER_MODULES);
    expect(all).toBe(ACTIVE_MODULES + OTHER_MODULES);
  });

  /** The denominator. This is the one that was refusing real candidates on dev. */
  it('lets a candidate who finished the active course sit the exam', async () => {
    const eligibility = await service.checkEligibility(finisherUserId);

    expect(eligibility.reason).toBeNull();
    expect(eligibility.eligible).toBe(true);
  });

  /**
   * The numerator, and what this one honestly guards.
   *
   * It passes against the unscoped code too, for its own reason (4 passed
   * against a total of 6). What it catches is the HALF fix: scope the
   * denominator to the active course and leave the numerator alone, and this
   * candidate has 4 passed rows against a total of 4 and walks into a KCA1
   * exam having passed only half of KCA1, the rest being demonstration
   * modules. That is the more dangerous direction - the other bug refuses
   * somebody, this one certifies them - so it is pinned separately rather than
   * ridden along on the test above.
   */
  it('does not let modules passed in another course make up the difference', async () => {
    const eligibility = await service.checkEligibility(halfFinisherUserId);

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason).toBe('kbs.exam.trainingIncomplete');
  });
});
