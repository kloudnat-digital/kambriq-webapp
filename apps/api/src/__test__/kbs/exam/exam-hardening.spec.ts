import { BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { KBS_JOBS, QUEUES } from '@kambriq/common/constants/queue';
import { KbsExamService } from '../../../kbs/exam/exam.service';
import { KbsPrismaService } from '../../../kbs/prisma/kbs-prisma.service';
import { UsersService } from '../../../core/users/users.service';
import { buildCandidate, mockI18n, mockKbsPrisma, mockQueue } from '../../utils';

/**
 * I21 - the two barriers behind the first one.
 *
 * `exam-integrity.dbspec.ts` proves the exam answers only what it served. These
 * are what stands behind that: a score that cannot exceed 100 whatever reaches
 * grading, and a submission after the deadline that closes the exam instead of
 * writing late answers into it.
 */
describe('I21 - exam hardening', () => {
  let service: KbsExamService;
  let prisma: ReturnType<typeof mockKbsPrisma>;
  let queue: ReturnType<typeof mockQueue>;

  beforeEach(async () => {
    prisma = mockKbsPrisma();
    queue = mockQueue();
    (prisma.$transaction as unknown as jest.Mock).mockImplementation((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(prisma),
    );
    const module = await Test.createTestingModule({
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

  it('caps the score at 100 even if more correct answers than served reach grading', async () => {
    const correct = (n: number) => ({
      id: `ea${n}`,
      selections: [{ id: `s${n}`, answer: { id: `a${n}`, isCorrect: true } }],
      question: { answers: [{ id: `a${n}`, isCorrect: true }] },
    });
    prisma.kbsExam.findUnique.mockResolvedValue({
      id: 'ex1',
      candidateId: 'c1',
      totalQuestions: 20,
      passingScore: 75,
      examAnswers: Array.from({ length: 25 }, (_, i) => correct(i)),
    });

    const { score } = await service.gradeExam('ex1');

    expect(score).toBe(100);
  });

  it('refuses a submission after the deadline, and closes the exam atomically instead', async () => {
    prisma.kbsCandidate.findUnique.mockResolvedValue(
      buildCandidate({ id: 'c1', userId: 'u1', status: 'EXAM_PENDING' }),
    );
    prisma.kbsExam.findUnique.mockResolvedValue({
      id: 'ex1',
      candidateId: 'c1',
      status: 'IN_PROGRESS',
      durationMinutes: 60,
      startedAt: new Date(Date.now() - 2 * 60 * 60_000), // two hours ago
    });
    prisma.kbsExam.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.submitExam('u1', 'ex1', { answers: [{ questionId: 'q1', answerIds: ['a1'] }] }),
    ).rejects.toThrow(BadRequestException);

    // Closed only if it was still open - the expiry job may have got there first.
    expect(prisma.kbsExam.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ex1', status: 'IN_PROGRESS' } }),
    );
    // The late answers are not written; what was saved in time is graded.
    expect(prisma.kbsExamAnswer.upsert).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      KBS_JOBS.GRADE_EXAM,
      expect.objectContaining({ examId: 'ex1' }),
      expect.objectContaining({ jobId: 'grade-exam-ex1' }),
    );
  });
});
