import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUES } from '@kambriq/common/constants/queue';
import { KbsExamService } from '../../../kbs/exam/exam.service';
import { KbsPrismaService } from '../../../kbs/prisma/kbs-prisma.service';
import { UsersService } from '../../../core/users/users.service';
import { buildCandidate, buildExam, mockI18n, mockKbsPrisma, mockQueue } from '../../utils';

/**
 * I40 - grading is asynchronous, and the candidate met a 400 for it.
 *
 * `submitExam` enqueues the grading job and answers `{"success":true}` with no
 * score. The web pushes straight to the results page, which calls
 * `getExamResults` and `notFound()` on any failure - so for the seconds between
 * submitting and grading, a candidate who has just sat a certification exam is
 * shown a **404**. I walked into it myself on dev.
 *
 * Grading stays asynchronous: making it synchronous would put a queue's work on
 * the request path for everybody, to spare a few seconds of waiting.
 *
 * What changes is the answer. `SUBMITTED` is not an error - it is the expected,
 * transient state of a healthy exam, and answering `400` for it is a status code
 * describing a fault where there is none. The service now reports the state, and
 * the screen can say "grading in progress" and wait, the way the delivery
 * journey already polls.
 *
 * The genuine refusals stay refusals: an exam that was never taken has no
 * results to report.
 */
describe('exam results while grading is still running (I40)', () => {
  let service: KbsExamService;
  let prisma: ReturnType<typeof mockKbsPrisma>;

  const userId = 'u1';

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = mockKbsPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbsExamService,
        { provide: KbsPrismaService, useValue: prisma },
        { provide: I18nService, useValue: mockI18n() },
        { provide: getQueueToken(QUEUES.KBS), useValue: mockQueue() },
        { provide: UsersService, useValue: { findManyByIds: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get(KbsExamService);
  });

  const arrange = (status: string) => {
    const candidate = buildCandidate({ userId, status: 'EXAM_PENDING' });
    prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
    const exam = buildExam({
      candidateId: candidate.id,
      status,
      score: null,
      submittedAt: status === 'SUBMITTED' ? new Date() : null,
      examAnswers: [],
    });
    prisma.kbsExam.findUnique.mockResolvedValue(exam);
    return exam;
  };

  it('does not refuse a submitted exam that is merely waiting to be graded', async () => {
    const exam = arrange('SUBMITTED');

    const result = await service.getExamResult(userId, exam.id);

    expect(result.status).toBe('SUBMITTED');
  });

  /**
   * The score is absent rather than zero. `0` is a verdict - the candidate got
   * nothing right - and saying it before grading has run would be a false
   * verdict on a person's certification.
   */
  it('reports no score yet rather than a score of zero', async () => {
    const exam = arrange('SUBMITTED');

    const result = await service.getExamResult(userId, exam.id);

    expect(result.score).toBeNull();
    expect(result.passed).toBe(false);
  });

  /**
   * And no per-module breakdown either. Before grading, `questionCorrect` is
   * null on every answer, so a breakdown would report "0 correct of N" for each
   * parcours - a verdict, and a false one, on a person's certification.
   */
  it('reports no per-module breakdown before grading has run', async () => {
    const candidate = buildCandidate({ userId, status: 'EXAM_PENDING' });
    prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
    prisma.kbsExam.findUnique.mockResolvedValue(
      buildExam({
        candidateId: candidate.id,
        status: 'SUBMITTED',
        score: null,
        submittedAt: new Date(),
        examAnswers: [
          {
            questionCorrect: null,
            question: { module: { id: 'm1', title: 'P0 - ECOSYSTEME KAMBRIQ' } },
          },
        ],
      }),
    );

    const result = await service.getExamResult(userId, 'e1');

    expect(result.breakdown).toEqual([]);
  });

  it('still answers fully once grading has finished', async () => {
    const candidate = buildCandidate({ userId, status: 'EXAM_PENDING' });
    prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
    const exam = buildExam({
      candidateId: candidate.id,
      status: 'PASSED',
      score: 100,
      submittedAt: new Date(),
      examAnswers: [],
    });
    prisma.kbsExam.findUnique.mockResolvedValue(exam);

    const result = await service.getExamResult(userId, exam.id);

    expect(result.status).toBe('PASSED');
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  /**
   * The refusals that are real ones. An exam nobody has taken has no results,
   * and answering "still grading" for it would be a different lie from the one
   * this fixes.
   */
  it.each(['SCHEDULED', 'IN_PROGRESS'])('still refuses results for a %s exam', async (status) => {
    const exam = arrange(status);

    await expect(service.getExamResult(userId, exam.id)).rejects.toThrow(BadRequestException);
  });
});
