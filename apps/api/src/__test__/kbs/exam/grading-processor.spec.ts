import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { KbsGradingProcessor } from '../../../kbs/exam/grading-processor';
import { KbsExamService } from '../../../kbs/exam/exam.service';
import { UsersService } from '../../../core/users/users.service';
import { KbsPrismaService } from '../../../kbs/prisma/kbs-prisma.service';
import { KbsCertificatesService } from '../../../kbs/certificates/certificates.service';
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
  let certificates: { withdrawExpiredCertifications: jest.Mock };

  beforeEach(async () => {
    resetIdCounter();
    certificates = { withdrawExpiredCertifications: jest.fn() };
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
        { provide: KbsCertificatesService, useValue: certificates },
        { provide: getQueueToken(QUEUES.KBS), useValue: queue },
      ],
    }).compile();

    processor = module.get(KbsGradingProcessor);
  });

  const makeJob = (name: string, data: Record<string, unknown>) =>
    ({ name, data }) as unknown as Job;

  describe('process()', () => {
    /**
     * I15 - the daily expiry sweep runs on the KBS queue's one processor.
     *
     * Not a second `@Processor(QUEUES.KBS)`: BullMQ hands each job to one
     * worker, and a second processor on a queue is how a dunning reminder was
     * silently eaten (`QUEUES.DUNNING`).
     */
    it('routes the certificate-expiry sweep to the certificates service', async () => {
      certificates.withdrawExpiredCertifications.mockResolvedValue(0);

      await processor.process(makeJob(KBS_JOBS.WITHDRAW_EXPIRED_CERTIFICATIONS, {}));

      expect(certificates.withdrawExpiredCertifications).toHaveBeenCalledTimes(1);
    });

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

    /**
     * The KCA role grant is gone from this processor entirely.
     *
     * It was unreachable after Q1 moved the grant to certificate issuance, and
     * an unreachable path that hands out an authorization on a score - without
     * even a `grantedBy` - is one `queue.add` away from reachable. The `kbs`
     * queue was checked empty first (waiting 0, active 0, delayed 0, paused 0,
     * failed 0; only historical completions carried the name), so no in-flight
     * job could be orphaned by removing it.
     *
     * It now falls to the default branch and throws, like any other name this
     * processor does not handle.
     */
    it('no longer routes the retired KCA role grant - it throws like any unknown name', async () => {
      await expect(
        processor.process(makeJob('kbs.grant-kca-role', { userId: 'u1' })),
      ).rejects.toThrow(/Unknown KBS job: kbs\.grant-kca-role/);
      expect(usersService.addRole).not.toHaveBeenCalled();
    });

    it('throws on an unknown job name, so BullMQ fails it instead of completing it', async () => {
      await expect(processor.process(makeJob('unknown.job', {}))).rejects.toThrow(
        /Unknown KBS job: unknown\.job/,
      );
    });
  });

  describe('handleGradeExam - passed', () => {
    /**
     * Passing an exam must not grant the credential's role.
     *
     * `KCA_CERTIFIED` gates the KAMNET agent routes. Granting it on the score
     * alone made somebody an agent before any certificate existed and before
     * any human had approved it - an authorisation preceding the credential it
     * represents. `issueCertificate` grants it now, in the same act that creates
     * the document and records who issued it.
     */
    it('sends the pass email and does NOT grant the KCA role', async () => {
      examService.gradeExam.mockResolvedValue({ score: 85, passed: true });

      const job = makeJob(KBS_JOBS.GRADE_EXAM, {
        examId: 'ex1',
        candidateId: 'c1',
        userId: 'u1',
      });

      await processor.process(job);

      expect(queue.add).not.toHaveBeenCalledWith(
        'kbs.grant-kca-role',
        expect.anything(),
        expect.anything(),
      );

      // Send pass email
      // A11: an exam result is transactional. `send`, not `sendUpdate`.
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'examPassed' }),
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
      expect(queue.add).not.toHaveBeenCalledWith('kbs.grant-kca-role', expect.anything(), null);

      // Fail email with retake info
      // A11: an exam result is transactional. `send`, not `sendUpdate`.
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'examFailed',
          args: expect.objectContaining({
            attemptsLeft: 2, // 3 - 1
          }),
        }),
      );
    });
  });
});
