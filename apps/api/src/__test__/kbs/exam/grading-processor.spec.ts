import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { KbsGradingProcessor } from '../../../kbs/exam/grading-processor';
import { KbsExamService } from '../../../kbs/exam/exam.service';
import { UsersService } from '../../../core/users/users.service';
import { KbsPrismaService } from '../../../kbs/prisma/kbs-prisma.service';
import { EmailService, QUEUES, KBS_JOBS } from '@kambriq/common';
import { Job } from 'bullmq';
import {
  mockQueue,
  mockEmailService,
  mockKbsPrisma,
  buildUserResponse,
  buildCandidate,
  resetIdCounter,
} from '../../utils';

describe('KbsGradingProcessor', () => {
  let processor: KbsGradingProcessor;
  let examService: { gradeExam: jest.Mock };
  let usersService: { findById: jest.Mock; addRole: jest.Mock };
  let emailService: ReturnType<typeof mockEmailService>;
  let queue: ReturnType<typeof mockQueue>;
  let kbsPrisma: ReturnType<typeof mockKbsPrisma>;

  beforeEach(async () => {
    resetIdCounter();
    examService = { gradeExam: jest.fn() };
    usersService = {
      findById: jest.fn().mockResolvedValue(buildUserResponse({ language: 'fr' })),
      addRole: jest.fn(),
    };
    emailService = mockEmailService();
    queue = mockQueue();
    kbsPrisma = mockKbsPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbsGradingProcessor,
        { provide: KbsExamService, useValue: examService },
        { provide: UsersService, useValue: usersService },
        { provide: EmailService, useValue: emailService },
        { provide: KbsPrismaService, useValue: kbsPrisma },
        { provide: getQueueToken(QUEUES.KBS), useValue: queue },
      ],
    }).compile();

    processor = module.get(KbsGradingProcessor);
  });

  const makeJob = (name: string, data: Record<string, unknown>) =>
    ({ name, data }) as unknown as Job;

  describe('process()', () => {
    it('routes GRADE_EXAM jobs correctly', async () => {
      examService.gradeExam.mockResolvedValue({ score: 80, passed: true });
      kbsPrisma.kbsCandidate.findUnique.mockResolvedValue(buildCandidate());

      const job = makeJob(KBS_JOBS.GRADE_EXAM, {
        examId: 'ex1',
        candidateId: 'c1',
        userId: 'u1',
      });

      await processor.process(job);

      expect(examService.gradeExam).toHaveBeenCalledWith('ex1');
    });

    it('routes GRANT_KCA_ROLE jobs correctly', async () => {
      const job = makeJob(KBS_JOBS.GRANT_KCA_ROLE, {
        userId: 'u1',
        examId: 'ex1',
      });

      await processor.process(job);

      expect(usersService.addRole).toHaveBeenCalledWith('u1', 'KCA_CERTIFIED');
    });

    it('returns null for unknown job types', async () => {
      const result = await processor.process(makeJob('unknown.job', {}));
      expect(result).toBeNull();
    });
  });

  describe('handleGradeExam - passed', () => {
    it('enqueues KCA role grant and sends pass email', async () => {
      examService.gradeExam.mockResolvedValue({ score: 85, passed: true });

      const job = makeJob(KBS_JOBS.GRADE_EXAM, {
        examId: 'ex1',
        candidateId: 'c1',
        userId: 'u1',
      });

      await processor.process(job);

      // Enqueue KCA role
      expect(queue.add).toHaveBeenCalledWith(
        KBS_JOBS.GRANT_KCA_ROLE,
        expect.objectContaining({ userId: 'u1' }),
        expect.any(Object),
      );

      // Send pass email
      expect(emailService.sendUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'examPassed' }),
        null,
      );
    });
  });

  describe('handleGradeExam - failed', () => {
    it('sends fail email with attempts remaining', async () => {
      examService.gradeExam.mockResolvedValue({ score: 50, passed: false });
      kbsPrisma.kbsCandidate.findUnique.mockResolvedValue(
        buildCandidate({ maxAttempts: 3, retakeCooldownDays: 7 }),
      );
      kbsPrisma.kbsExam.count.mockResolvedValue(1); // 1 attempt used

      const job = makeJob(KBS_JOBS.GRADE_EXAM, {
        examId: 'ex1',
        candidateId: 'c1',
        userId: 'u1',
      });

      await processor.process(job);

      // No KCA role enqueued
      expect(queue.add).not.toHaveBeenCalledWith(KBS_JOBS.GRANT_KCA_ROLE, expect.anything(), null);

      // Fail email with retake info
      expect(emailService.sendUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'examFailed',
          args: expect.objectContaining({
            attemptsLeft: 2, // 3 - 1
          }),
        }),
        null,
      );
    });
  });
});
