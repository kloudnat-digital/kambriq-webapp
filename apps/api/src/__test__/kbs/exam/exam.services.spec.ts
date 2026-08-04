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
      expect(prisma.kbsExam.create).toHaveBeenCalled();
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
    it('upserts answer slot and replaces selections atomically', async () => {
      const candidate = buildCandidate({ status: 'EXAM_PENDING' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);

      const exam = buildExam({
        candidateId: candidate.id,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      });
      prisma.kbsExam.findUnique.mockResolvedValue(exam);

      // Mock transaction callback
      prisma.$transaction.mockImplementation(async (cb: (client: unknown) => Promise<unknown>) => {
        const tx = {
          kbsExamAnswer: {
            upsert: jest.fn().mockResolvedValue({ id: 'ea1' }),
          },
          kbsExamAnswerSelection: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
        };
        return cb(tx);
      });

      await service.saveAnswer(candidate.userId, exam.id, {
        questionId: 'q1',
        answerIds: ['a1', 'a2'],
        flagged: true,
      });

      expect(prisma.$transaction).toHaveBeenCalled();
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
      prisma.kbsExam.update.mockResolvedValue({});

      // Mock per-answer transaction
      prisma.$transaction.mockImplementation(async (cb: (client: unknown) => Promise<unknown>) => {
        const tx = {
          kbsExamAnswer: {
            upsert: jest.fn().mockResolvedValue({ id: 'ea1' }),
          },
          kbsExamAnswerSelection: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
        };
        return cb(tx);
      });

      await service.submitExam(candidate.userId, 'exam-1', {
        answers: [{ questionId: 'q1', answerIds: ['a1'] }],
      });

      expect(prisma.kbsExam.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUBMITTED' }),
        }),
      );
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
        passingScore: 75,
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
      expect(result.passed).toBe(false); // 50 < 75
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

    it('sets PASSED + CERTIFIED when score >= passingScore', async () => {
      const exam = buildExam({
        id: 'ex1',
        candidateId: 'cand1',
        passingScore: 75,
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
