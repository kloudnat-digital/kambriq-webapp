import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Test, TestingModule } from '@nestjs/testing';
import { KbsExamService } from '../../../kbs/exam/exam.service';
import { KbsPrismaService } from '../../../kbs/prisma/kbs-prisma.service';
import { UsersService } from '../../../core/users/users.service';
import {
  buildCandidate,
  buildExam,
  mockI18n,
  mockKbsPrisma,
  mockQueue,
  resetIdCounter,
} from '../../utils';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUES } from '@kambriq/common/constants/queue';
import { DEFAULT_EXAM_QUESTION_COUNT, EXAM_PASSING_SCORE } from '@kambriq/common/constants/kbs';

describe('KbsExamService', () => {
  let service: KbsExamService;
  let prisma: ReturnType<typeof mockKbsPrisma>;
  let queue: ReturnType<typeof mockQueue>;

  beforeEach(async () => {
    jest.clearAllMocks();
    resetIdCounter();
    prisma = mockKbsPrisma();
    queue = mockQueue();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbsExamService,
        { provide: KbsPrismaService, useValue: prisma },
        { provide: I18nService, useValue: mockI18n() },
        { provide: getQueueToken(QUEUES.KBS), useValue: queue },
        { provide: UsersService, useValue: { findManyByIds: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get(KbsExamService);
  });

  // ----- CHECK ELIGIBILITY ----- //

  describe('checkEligibility', () => {
    it('returns eligible=true when all conditions are met', async () => {
      const candidate = buildCandidate({ status: 'EXAM_PENDING' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsExamQuestion.count.mockResolvedValue(20); // pool exists
      prisma.kbsExam.findFirst
        .mockResolvedValueOnce(null) // 1st call: no active exam
        .mockResolvedValueOnce(null); // 2nd call: no last failed exam
      prisma.kbsExam.count.mockResolvedValue(0); // 0 attempts
      prisma.kbsModule.count.mockResolvedValue(3);
      prisma.kbsCandidateProgress.count.mockResolvedValue(3); // all completed

      const result = await service.checkEligibility(candidate.userId);

      expect(result.eligible).toBe(true);
    });

    it('returns eligible=false for already certified candidate', async () => {
      const candidate = buildCandidate({ status: 'CERTIFIED' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsCertificate.findUnique.mockResolvedValue({
        validUntil: new Date(Date.now() + 86_400_000), // valid cert
      });

      const result = await service.checkEligibility(candidate.userId);
      expect(result.eligible).toBe(false);
    });

    it('returns eligible=false when max attempts reached', async () => {
      const candidate = buildCandidate({ status: 'FAILED', maxAttempts: 3 });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsExamQuestion.count.mockResolvedValue(20);
      prisma.kbsExam.findFirst.mockResolvedValue(null);
      prisma.kbsExam.count.mockResolvedValue(3); // hit the max

      const result = await service.checkEligibility(candidate.userId);
      expect(result.eligible).toBe(false);
    });

    it('returns eligible=false when active exam exists', async () => {
      const candidate = buildCandidate({ status: 'EXAM_PENDING' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsExamQuestion.count.mockResolvedValue(20);
      prisma.kbsExam.findFirst.mockResolvedValue(buildExam({ status: 'SCHEDULED' }));

      const result = await service.checkEligibility(candidate.userId);
      expect(result.eligible).toBe(false);
    });

    it('throws ServiceUnavailableException when question pool is empty', async () => {
      const candidate = buildCandidate({ status: 'EXAM_PENDING' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsExamQuestion.count.mockResolvedValue(0);

      await expect(service.checkEligibility(candidate.userId)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  // ----- SCHEDULE EXAM ----- //

  describe('scheduleExam', () => {
    it('creates a SCHEDULED exam for eligible candidate', async () => {
      const candidate = buildCandidate({ status: 'EXAM_PENDING' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsExamQuestion.count.mockResolvedValue(20);
      prisma.kbsExam.findFirst.mockResolvedValue(null);
      prisma.kbsExam.count.mockResolvedValue(0);
      prisma.kbsModule.count.mockResolvedValue(3);
      prisma.kbsCandidateProgress.count.mockResolvedValue(3);

      const exam = buildExam({
        candidateId: candidate.id,
        status: 'SCHEDULED',
      });
      prisma.kbsExam.create.mockResolvedValue(exam);

      const result = await service.scheduleExam(candidate.userId);

      expect(result.status).toBe('SCHEDULED');
      /**
       * The threshold is stamped onto the row here, and `gradeExam` judges on
       * `exam.passingScore` rather than on the constant - so this write is what
       * decides the verdict, and it is also the only thing keeping the
       * `@default(75)` in `prisma/kbs/schema.prisma` unreachable.
       * `toHaveBeenCalled()` said nothing about either.
       */
      expect(prisma.kbsExam.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ passingScore: EXAM_PASSING_SCORE }),
        }),
      );
    });

    it('throws ForbiddenException if not eligible', async () => {
      const candidate = buildCandidate({ status: 'CANDIDATE' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);

      await expect(service.scheduleExam(candidate.userId)).rejects.toThrow(ForbiddenException);
    });
  });

  // ----- START EXAM ----- //

  describe('startExam', () => {
    it('returns questions without correct answers and sets IN_PROGRESS', async () => {
      const candidate = buildCandidate({ status: 'EXAM_PENDING' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);

      const exam = buildExam({
        candidateId: candidate.id,
        status: 'SCHEDULED',
        scheduledAt: new Date(Date.now() - 60_000), // 1min ago
      });
      prisma.kbsExam.findUnique.mockResolvedValue(exam);
      prisma.kbsExamQuestion.count.mockResolvedValue(20);
      prisma.kbsSettings.findFirst.mockResolvedValue({ examQuestionCount: 5 });

      // Questions pool
      const questions = Array.from({ length: 10 }, (_, i) => ({
        id: `eq${i}`,
        text: `Question ${i}`,
        type: 'SINGLE',
        module: { id: 'mod1', title: 'Module 1' },
        answers: [
          { id: `ea${i}_1`, text: 'A' },
          { id: `ea${i}_2`, text: 'B' },
        ],
      }));
      prisma.kbsExamQuestion.findMany.mockResolvedValue(questions);
      prisma.kbsExam.update.mockResolvedValue({});

      const result = await service.startExam(candidate.userId, exam.id);

      expect(result.questions).toHaveLength(5); // sliced to count
      expect(result.totalQuestions).toBe(5);
      expect(prisma.kbsExam.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'IN_PROGRESS' }),
        }),
      );
    });

    /**
     * The exam runs at its stated length or it does not run.
     *
     * The old guard was `poolSize === 0`, so a pool of 19 against a required 20
     * produced a 19-question certification exam with no wrong number anywhere:
     * `totalQuestions` was set from `shuffled.length` and the score divided by
     * that. This asserts the exact length at the real default, not an upper
     * bound - `toBeLessThanOrEqual(20)` would pass on a shrunken exam, which is
     * precisely how the quiz path stayed green while serving five questions.
     */
    it('serves exactly examQuestionCount questions at the real default of 20', async () => {
      const candidate = buildCandidate({ status: 'EXAM_PENDING' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);

      const exam = buildExam({
        candidateId: candidate.id,
        status: 'SCHEDULED',
        scheduledAt: new Date(Date.now() - 60_000),
      });
      prisma.kbsExam.findUnique.mockResolvedValue(exam);
      prisma.kbsSettings.findFirst.mockResolvedValue(null); // falls back to the default
      prisma.kbsExamQuestion.count.mockResolvedValue(60);

      const questions = Array.from({ length: 60 }, (_, i) => ({
        id: `eq${i}`,
        text: `Question ${i}`,
        type: 'SINGLE',
        module: { id: 'mod1', title: 'Module 1' },
        answers: [
          { id: `ea${i}_1`, text: 'A' },
          { id: `ea${i}_2`, text: 'B' },
        ],
      }));
      prisma.kbsExamQuestion.findMany.mockResolvedValue(questions);
      prisma.kbsExam.update.mockResolvedValue({});

      const result = await service.startExam(candidate.userId, exam.id);

      expect(result.questions).toHaveLength(DEFAULT_EXAM_QUESTION_COUNT);
      expect(result.totalQuestions).toBe(DEFAULT_EXAM_QUESTION_COUNT);
      expect(prisma.kbsExam.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ totalQuestions: DEFAULT_EXAM_QUESTION_COUNT }),
        }),
      );
    });

    it('refuses to start, loudly, when the pool is one question short', async () => {
      const candidate = buildCandidate({ status: 'EXAM_PENDING' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);

      const exam = buildExam({
        candidateId: candidate.id,
        status: 'SCHEDULED',
        scheduledAt: new Date(Date.now() - 60_000),
      });
      prisma.kbsExam.findUnique.mockResolvedValue(exam);
      prisma.kbsSettings.findFirst.mockResolvedValue({ examQuestionCount: 20 });
      prisma.kbsExamQuestion.count.mockResolvedValue(19);

      // The shortfall must name both numbers. A generic "no questions" message
      // sends whoever is on call looking for an empty table.
      await expect(service.startExam(candidate.userId, exam.id)).rejects.toThrow(
        /pool 19, requis 20/,
      );
      expect(prisma.kbsExam.update).not.toHaveBeenCalled();
    });

    it('throws if exam does not belong to the candidate', async () => {
      const candidate = buildCandidate({ id: 'cand-1', status: 'EXAM_PENDING' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsExam.findUnique.mockResolvedValue(buildExam({ candidateId: 'other-candidate' }));

      await expect(service.startExam(candidate.userId, 'exam-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws if exam is not in SCHEDULED status', async () => {
      const candidate = buildCandidate({ status: 'EXAM_PENDING' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsExam.findUnique.mockResolvedValue(
        buildExam({ candidateId: candidate.id, status: 'IN_PROGRESS' }),
      );

      await expect(service.startExam(candidate.userId, 'exam-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ----- SAVE ANSWER ----- //

  describe('saveAnswer', () => {
    it('writes onto the served slot and replaces selections atomically', async () => {
      const candidate = buildCandidate({ status: 'EXAM_PENDING' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);

      const exam = buildExam({
        candidateId: candidate.id,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      });
      prisma.kbsExam.findUnique.mockResolvedValue(exam);

      // I21 - the slot was created at start; saving looks it up, never creates it.
      const tx = {
        kbsExamAnswer: {
          findUnique: jest.fn().mockResolvedValue({ id: 'ea1' }),
          update: jest.fn().mockResolvedValue({ id: 'ea1' }),
          upsert: jest.fn(),
        },
        kbsExamQuestionAnswer: { count: jest.fn().mockResolvedValue(2) },
        kbsExamAnswerSelection: {
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
      };
      prisma.$transaction.mockImplementation(async (cb: (client: unknown) => Promise<unknown>) =>
        cb(tx),
      );

      await service.saveAnswer(candidate.userId, exam.id, {
        questionId: 'q1',
        answerIds: ['a1', 'a2'],
        flagged: true,
      });

      expect(tx.kbsExamAnswer.upsert).not.toHaveBeenCalled();
      expect(tx.kbsExamQuestionAnswer.count).toHaveBeenCalledWith({
        where: { id: { in: ['a1', 'a2'] }, questionId: 'q1' },
      });
      expect(tx.kbsExamAnswerSelection.createMany).toHaveBeenCalledWith({
        data: [
          { examAnswerId: 'ea1', answerId: 'a1' },
          { examAnswerId: 'ea1', answerId: 'a2' },
        ],
      });
    });

    it('throws if exam is not IN_PROGRESS', async () => {
      const candidate = buildCandidate({ status: 'EXAM_PENDING' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsExam.findUnique.mockResolvedValue(
        buildExam({ candidateId: candidate.id, status: 'SUBMITTED' }),
      );

      await expect(
        service.saveAnswer(candidate.userId, 'exam-1', {
          questionId: 'q1',
          answerIds: ['a1'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ----- SUBMIT EXAM ----- //

  describe('submitExam', () => {
    it('sets status to SUBMITTED and enqueues grading job', async () => {
      const candidate = buildCandidate({ status: 'EXAM_PENDING' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsExam.findUnique.mockResolvedValue(
        buildExam({
          candidateId: candidate.id,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        }),
      );
      // I21 - claim and answers in one transaction; the claim holds only while
      // the exam is still IN_PROGRESS.
      const tx = {
        kbsExam: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        kbsExamAnswer: {
          findUnique: jest.fn().mockResolvedValue({ id: 'ea1' }),
          update: jest.fn().mockResolvedValue({ id: 'ea1' }),
        },
        kbsExamQuestionAnswer: { count: jest.fn().mockResolvedValue(1) },
        kbsExamAnswerSelection: {
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
      };
      prisma.$transaction.mockImplementation(async (cb: (client: unknown) => Promise<unknown>) =>
        cb(tx),
      );

      await service.submitExam(candidate.userId, 'exam-1', {
        answers: [{ questionId: 'q1', answerIds: ['a1'] }],
      });

      expect(tx.kbsExam.updateMany).toHaveBeenCalledWith({
        where: { id: 'exam-1', status: 'IN_PROGRESS' },
        data: expect.objectContaining({ status: 'SUBMITTED' }),
      });
      expect(queue.add).toHaveBeenCalledWith(
        'kbs.grade-exam',
        expect.objectContaining({ examId: 'exam-1' }),
        expect.any(Object),
      );
    });
  });

  // ----- GRADE EXAM ----- //

  describe('gradeExam', () => {
    it('calculates score, updates exam + candidate status', async () => {
      const exam = buildExam({
        id: 'ex1',
        candidateId: 'cand1',
        passingScore: EXAM_PASSING_SCORE,
        totalQuestions: 2,
        examAnswers: [
          {
            id: 'ea1',
            selections: [{ id: 's1', answer: { id: 'a1', isCorrect: true } }],
            question: {
              answers: [
                { id: 'a1', isCorrect: true },
                { id: 'a2', isCorrect: false },
              ],
            },
          },
          {
            id: 'ea2',
            selections: [{ id: 's2', answer: { id: 'a4', isCorrect: false } }],
            question: {
              answers: [
                { id: 'a3', isCorrect: true },
                { id: 'a4', isCorrect: false },
              ],
            },
          },
        ],
      });
      prisma.kbsExam.findUnique.mockResolvedValue(exam);
      prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
      prisma.kbsExam.update.mockResolvedValue({});
      prisma.kbsCandidate.update.mockResolvedValue({});

      const result = await service.gradeExam('ex1');

      expect(result.score).toBe(50); // 1/2 correct
      expect(result.passed).toBe(false); // 50 < EXAM_PASSING_SCORE
      expect(prisma.kbsExam.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
      expect(prisma.kbsCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    /**
     * The test this replaces was called "sets PASSED + CERTIFIED" and asserted
     * only that the EXAM was PASSED. It never looked at the candidate status at
     * all - the half of its own name that turned out to be wrong was the half it
     * did not check.
     *
     * Passing gives EXAM_PASSED and no `certifiedAt`. `certifiedAt` is the date
     * on the certificate, and issuance is what puts it there.
     */
    it('sets the exam PASSED and the candidate EXAM_PASSED, certifying nothing', async () => {
      const exam = buildExam({
        id: 'ex1',
        candidateId: 'cand1',
        passingScore: EXAM_PASSING_SCORE,
        totalQuestions: 1,
        examAnswers: [
          {
            id: 'ea1',
            selections: [{ id: 's1', answer: { id: 'a1', isCorrect: true } }],
            question: {
              answers: [{ id: 'a1', isCorrect: true }],
            },
          },
        ],
      });
      prisma.kbsExam.findUnique.mockResolvedValue(exam);
      prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
      prisma.kbsExam.update.mockResolvedValue({});
      prisma.kbsCandidate.update.mockResolvedValue({});

      const result = await service.gradeExam('ex1');

      expect(result.score).toBe(100);
      expect(result.passed).toBe(true);
      expect(prisma.kbsExam.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PASSED' }),
        }),
      );

      expect(prisma.kbsCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'EXAM_PASSED' }),
        }),
      );

      // Not CERTIFIED, and no certification date.
      const candidateData = (
        prisma.kbsCandidate.update.mock.calls[0]?.[0] as { data: Record<string, unknown> }
      ).data;
      expect(candidateData['status']).not.toBe('CERTIFIED');
      expect(candidateData).not.toHaveProperty('certifiedAt');
    });
  });

  // ----- ADMIN - CANCEL / RESET ----- //

  describe('cancelExam', () => {
    it('cancels a SCHEDULED exam with a reason', async () => {
      const exam = buildExam({ status: 'SCHEDULED' });
      prisma.kbsExam.findUnique.mockResolvedValue(exam);
      prisma.kbsExam.update.mockResolvedValue({ ...exam, status: 'CANCELLED' });

      const result = await service.cancelExam(exam.id, {
        reason: 'Admin request',
      });
      expect(result.status).toBe('CANCELLED');
    });

    it('throws if exam is already PASSED/FAILED', async () => {
      prisma.kbsExam.findUnique.mockResolvedValue(buildExam({ status: 'PASSED' }));

      await expect(service.cancelExam('ex1', { reason: 'Too late' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('resetAttempts', () => {
    it('increments cycle and transitions FAILED → EXAM_PENDING', async () => {
      const candidate = buildCandidate({ status: 'FAILED', currentCycle: 1 });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsCandidate.update.mockResolvedValue({});

      const result = await service.resetAttempts(candidate.id);

      expect(prisma.kbsCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentCycle: { increment: 1 },
            status: 'EXAM_PENDING',
          }),
        }),
      );
      expect(result).toHaveProperty('message');
    });

    it('throws NotFoundException for unknown candidate', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(null);

      await expect(service.resetAttempts('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ----- EXAM QUESTION CRUD ----- //

  describe('createExamQuestion', () => {
    it('creates an exam pool question', async () => {
      prisma.kbsModule.findUnique.mockResolvedValue({ id: 'mod1' });
      const question = { id: 'eq1', text: 'Q?', type: 'SINGLE', answers: [] };
      prisma.kbsExamQuestion.create.mockResolvedValue(question);

      const result = await service.createExamQuestion({
        text: 'Q?',
        type: 'SINGLE',
        moduleId: 'mod1',
        answers: [
          { text: 'A', isCorrect: true },
          { text: 'B', isCorrect: false },
        ],
      });

      expect(result.id).toBe('eq1');
    });

    it('throws NotFoundException if module does not exist', async () => {
      prisma.kbsModule.findUnique.mockResolvedValue(null);

      await expect(
        service.createExamQuestion({
          text: 'Q?',
          type: 'SINGLE',
          moduleId: 'bad',
          answers: [
            { text: 'A', isCorrect: true },
            { text: 'B', isCorrect: false },
          ],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
