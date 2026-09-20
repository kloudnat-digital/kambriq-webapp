import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { DateTime } from 'luxon';
import { InjectQueue } from '@nestjs/bullmq';
import {
  buildPaginatedResponse,
  CandidateStatus,
  DEFAULT_EXAM_QUESTION_COUNT,
  EXAM_PASSING_SCORE,
  ExamStatus,
  KBS_JOBS,
  PaginationQuery,
  QUEUES,
} from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';
import {
  CancelExamDto,
  CreateExamQuestionDto,
  SaveAnswerDto,
  SubmitExamDto,
  UpdateExamQuestionDto,
} from './dto/exam.dto';
import { KbsPrismaService } from '../prisma/kbs-prisma.service';
import { NEWEST_FIRST } from '../certificates/current-certificate';
import { UsersService } from '../../core/users/users.service';
import { readActiveCourse } from '../settings/active-course';
import type { Prisma } from '@kambriq/common/prisma/kbs-client/client';

type KbsTransaction = Prisma.TransactionClient;

@Injectable()
export class KbsExamService {
  private readonly logger = new Logger(KbsExamService.name);

  constructor(
    private readonly prisma: KbsPrismaService,
    @InjectQueue(QUEUES.KBS) private readonly kbsQueue: Queue,
    private readonly i18n: I18nService,
    private readonly usersService: UsersService,
  ) {}

  // ----- Check Eligibility ---------------------------
  async checkEligibility(userId: string) {
    // Non-throwing lookup so CANDIDATE-status users get a proper "not eligible"
    // response instead of a 403.
    const candidate = await this.findCandidateByUserIdOrThrow(userId);

    if (candidate.status === CandidateStatus.CANDIDATE) {
      return {
        ...(await this.buildBaseEligibility(candidate)),
        eligible: false,
        reason: this.t('kbs.enrollment.awaitingVerification'),
        nextAttemptAt: null,
        activeExamId: null,
      };
    }

    if (candidate.status === CandidateStatus.IN_TRAINING) {
      return {
        ...(await this.buildBaseEligibility(candidate)),
        eligible: false,
        reason: this.t('kbs.exam.completeAllModules'),
        nextAttemptAt: null,
        activeExamId: null,
      };
    }

    // Passed, waiting on an admin to issue the certificate. Not eligible for
    // another exam, and not certified either - the candidate is told which.
    if (candidate.status === CandidateStatus.EXAM_PASSED) {
      return {
        ...(await this.buildBaseEligibility(candidate)),
        eligible: false,
        reason: this.t('kbs.exam.awaitingCertificate'),
        nextAttemptAt: null,
        activeExamId: null,
      };
    }

    // Certified but certificate expired → renewal path
    if (candidate.status === CandidateStatus.CERTIFIED) {
      // I15 renewal: a candidate may hold several certificates; the current is the newest.
      const cert = await this.prisma.kbsCertificate.findFirst({
        where: { candidateId: candidate.id },
        ...NEWEST_FIRST,
      });
      if (cert && cert.validUntil < new Date()) {
        return await this.checkEligibilityRules(candidate, true);
      }
      return {
        ...(await this.buildBaseEligibility(candidate)),
        eligible: false,
        reason: this.t('kbs.exam.alreadyCertified'),
        nextAttemptAt: null,
        activeExamId: null,
      };
    }

    // EXAM_PENDING or FAILED → run the full eligibility rules
    return await this.checkEligibilityRules(candidate, false);
  }

  // ----- Schedule & Start Exam

  async scheduleExam(userId: string) {
    const candidate = await this.requireVerifiedCandidateByUserIdOrThrow(userId);
    const eligibility = await this.checkEligibility(userId);

    if (!eligibility.eligible) {
      throw new ForbiddenException(eligibility.reason);
    }

    const attemptCount = await this.prisma.kbsExam.count({
      where: {
        candidateId: candidate.id,
        cycle: candidate.currentCycle,
        status: {
          in: [ExamStatus.PASSED, ExamStatus.FAILED, ExamStatus.SUBMITTED],
        },
      },
    });

    const exam = await this.prisma.kbsExam.create({
      data: {
        candidateId: candidate.id,
        cycle: candidate.currentCycle,
        attemptNumber: attemptCount + 1,
        passingScore: EXAM_PASSING_SCORE,
        status: ExamStatus.SCHEDULED,
        scheduledAt: new Date(),
        // totalQuestions defaults to 0; startExam will set the real value after slicing
      },
    });

    this.logger.log(`Exam scheduled: ${exam.id}`);
    return exam;
  }

  async startExam(userId: string, examId: string) {
    const candidate = await this.requireVerifiedCandidateByUserIdOrThrow(userId);
    const exam = await this.findExamOrThrow(examId);

    const now = DateTime.utc();
    if (!exam.scheduledAt) {
      throw new BadRequestException(this.t('kbs.exam.notScheduled'));
    }
    const scheduled = DateTime.fromJSDate(exam.scheduledAt);

    if (exam.candidateId !== candidate.id) {
      throw new ForbiddenException(this.t('kbs.exam.notYours'));
    }

    if (exam.status !== ExamStatus.SCHEDULED) {
      throw new BadRequestException(
        this.t('kbs.exam.cannotStart', undefined, { status: exam.status }),
      );
    }

    if (now < scheduled) {
      throw new BadRequestException(this.t('kbs.exam.notYetAvailable'));
    }

    if (now > scheduled.plus({ minutes: exam.durationMinutes })) {
      throw new BadRequestException(this.t('kbs.exam.startWindowExpired'));
    }

    await this.ensureQuestionPoolAvailable();

    const settings = await readActiveCourse(this.prisma);
    const questionCount = settings?.examQuestionCount ?? DEFAULT_EXAM_QUESTION_COUNT;

    // I36 - scoped to the active course. Unfiltered, this drew from every exam
    // question in the database, so a second course meant a candidate could be
    // examined on a course they never studied.
    const allQuestions = await this.prisma.kbsExamQuestion.findMany({
      where: { module: { courseId: this.activeCourseIdOrThrow(settings) } },
      include: {
        answers: { select: { id: true, text: true } }, // No isCorrect!
        module: { select: { id: true, title: true } },
      },
    });

    const shuffled = this.shuffle(allQuestions)
      .slice(0, questionCount)
      .map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        module: q.module,
        answers: this.shuffle(q.answers),
      }));

    const startedAt = new Date();
    /**
     * I21 - the exam records WHICH questions it served, not only how many.
     *
     * One empty answer slot per served question, written in the same
     * transaction as the start. `saveAnswer` and `submitExam` accept answers
     * only on these slots. Before this, only `totalQuestions` was stored, any
     * pool question could be answered, and an exam of 20 graded at 300.
     */
    await this.prisma.$transaction([
      this.prisma.kbsExam.update({
        where: { id: exam.id },
        data: {
          status: ExamStatus.IN_PROGRESS,
          startedAt,
          totalQuestions: shuffled.length,
        },
      }),
      this.prisma.kbsExamAnswer.createMany({
        data: shuffled.map((q) => ({ examId: exam.id, questionId: q.id })),
      }),
    ]);

    // Schedule auto-expiry job - fires when the exam duration elapses.
    // The processor will force-submit and grade the exam if it is still IN_PROGRESS.
    const delayMs = exam.durationMinutes * 60_000;
    await this.kbsQueue.add(
      KBS_JOBS.EXPIRE_EXAM,
      { examId: exam.id, candidateId: candidate.id, userId: candidate.userId },
      {
        jobId: `expire-exam-${exam.id}`,
        delay: delayMs,
      },
    );

    this.logger.log('Exam started %o', {
      examId: exam.id,
      candidateId: candidate.id,
    });

    return {
      examId: exam.id,
      durationMinutes: exam.durationMinutes,
      totalQuestions: shuffled.length,
      startedAt,
      expiresAt: new Date(startedAt.getTime() + delayMs),
      questions: shuffled,
    };
  }

  // ----- Save Answer (autosave during exam) ---------------------------
  async saveAnswer(userId: string, examId: string, dto: SaveAnswerDto) {
    const candidate = await this.requireVerifiedCandidateByUserIdOrThrow(userId);
    const exam = await this.findExamOrThrow(examId);

    if (exam.candidateId !== candidate.id) {
      throw new ForbiddenException(this.t('kbs.exam.notYours'));
    }

    if (exam.status !== ExamStatus.IN_PROGRESS) {
      throw new BadRequestException(this.t('kbs.exam.notInProgress'));
    }

    this.assertExamNotExpired(exam);

    return this.prisma.$transaction(async (tx) => {
      // I21 - only a question this exam served, only with that question's answers.
      const slot = await this.servedSlotOrThrow(tx, examId, dto.questionId, dto.answerIds);
      const saved = await tx.kbsExamAnswer.update({
        where: { id: slot.id },
        data: { flagged: dto.flagged ?? false, answeredAt: new Date() },
      });
      await this.replaceSelections(tx, slot.id, dto.answerIds);
      return saved;
    });
  }

  // ----- Submit Exam (for grading via BullMQ) ------------------------
  async submitExam(userId: string, examId: string, dto: SubmitExamDto) {
    const candidate = await this.requireVerifiedCandidateByUserIdOrThrow(userId);
    const exam = await this.findExamOrThrow(examId);

    if (exam.candidateId !== candidate.id) {
      throw new ForbiddenException(this.t('kbs.exam.notYours'));
    }

    if (exam.status !== ExamStatus.IN_PROGRESS) {
      throw new BadRequestException(this.t('kbs.exam.notInProgress'));
    }

    /**
     * I21 - a submission after the deadline writes nothing.
     *
     * Only `saveAnswer` checked the clock, so a late submit could write answers
     * after time until the expiry job ran. Past the deadline plus a short grace
     * for the network, the exam is closed on what was saved in time - atomically,
     * only if it is still open, since the expiry job may have closed it first -
     * graded, and the submission is refused.
     */
    const deadline = this.deadlineOf(exam);
    if (deadline && Date.now() > deadline.getTime() + KbsExamService.SUBMIT_GRACE_MS) {
      const closed = await this.prisma.kbsExam.updateMany({
        where: { id: examId, status: ExamStatus.IN_PROGRESS },
        data: { status: ExamStatus.SUBMITTED, submittedAt: deadline },
      });
      if (closed.count > 0) await this.enqueueGrading(examId, candidate);
      throw new BadRequestException(this.t('kbs.exam.timeExpired'));
    }

    /**
     * The claim and the final answers in ONE transaction. The claim succeeds only
     * while the exam is still IN_PROGRESS; an answer on a question this exam did
     * not serve rolls the whole submission back and leaves the exam open.
     */
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.kbsExam.updateMany({
        where: { id: examId, status: ExamStatus.IN_PROGRESS },
        data: { status: ExamStatus.SUBMITTED, submittedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new BadRequestException(this.t('kbs.exam.notInProgress'));
      }
      for (const answer of dto.answers) {
        const slot = await this.servedSlotOrThrow(tx, examId, answer.questionId, answer.answerIds);
        await tx.kbsExamAnswer.update({ where: { id: slot.id }, data: { answeredAt: new Date() } });
        await this.replaceSelections(tx, slot.id, answer.answerIds);
      }
    });

    await this.enqueueGrading(examId, candidate);
  }

  /** A short allowance for the network between the last click and the request. */
  private static readonly SUBMIT_GRACE_MS = 30_000;

  private deadlineOf(exam: { startedAt: Date | null; durationMinutes: number }): Date | null {
    return exam.startedAt
      ? new Date(exam.startedAt.getTime() + exam.durationMinutes * 60_000)
      : null;
  }

  private async enqueueGrading(examId: string, candidate: { id: string; userId: string }) {
    await this.kbsQueue.add(
      KBS_JOBS.GRADE_EXAM,
      { examId, candidateId: candidate.id, userId: candidate.userId },
      { jobId: `grade-exam-${examId}` },
    );
  }

  /**
   * I21 - an answer is accepted only on a question this exam served, and only
   * with answer ids that belong to that question.
   */
  private async servedSlotOrThrow(
    tx: KbsTransaction,
    examId: string,
    questionId: string,
    answerIds: string[],
  ) {
    const slot = await tx.kbsExamAnswer.findUnique({
      where: { examId_questionId: { examId, questionId } },
    });
    if (!slot) throw new BadRequestException(this.t('kbs.exam.questionNotServed'));

    const unique = [...new Set(answerIds)];
    if (unique.length > 0) {
      const owned = await tx.kbsExamQuestionAnswer.count({
        where: { id: { in: unique }, questionId },
      });
      if (owned !== unique.length) {
        throw new BadRequestException(this.t('kbs.exam.answerNotOfQuestion'));
      }
    }
    return slot;
  }

  /** Replaces a slot's selections (SINGLE and MULTIPLE alike). */
  private async replaceSelections(tx: KbsTransaction, examAnswerId: string, answerIds: string[]) {
    await tx.kbsExamAnswerSelection.deleteMany({ where: { examAnswerId } });
    const unique = [...new Set(answerIds)];
    if (unique.length > 0) {
      await tx.kbsExamAnswerSelection.createMany({
        data: unique.map((answerId) => ({ examAnswerId, answerId })),
      });
    }
  }

  // ----- Get Results ---------------------------
  async getExamResult(userId: string, examId: string) {
    const candidate = await this.requireVerifiedCandidateByUserIdOrThrow(userId);
    const exam = await this.prisma.kbsExam.findUnique({
      where: { id: examId },
      include: {
        examAnswers: {
          include: {
            question: {
              include: {
                module: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(this.t('kbs.exam.notFound', undefined, { id: examId }));
    }

    if (exam.candidateId !== candidate.id) {
      throw new ForbiddenException(this.t('kbs.exam.notYours'));
    }

    /**
     * I40 - SUBMITTED is not a fault, it is the healthy transient state.
     *
     * Grading runs on a queue, so between submitting and being graded an exam
     * sits at SUBMITTED for a few seconds. Answering 400 for that made the web
     * call `notFound()`, and a candidate who had just sat a certification exam
     * was shown a 404. Grading stays asynchronous; what changes is that the
     * service reports the state instead of calling it an error, so the screen
     * can say "grading in progress" and wait.
     *
     * The real refusals stay refusals: an exam that was never sat has no
     * results, and answering "still grading" for it would be its own lie.
     */
    const graded = [ExamStatus.PASSED, ExamStatus.FAILED].includes(exam.status as ExamStatus);
    if (!graded && exam.status !== ExamStatus.SUBMITTED) {
      throw new BadRequestException(this.t('kbs.exam.resultsNotReady'));
    }

    const moduleScores = new Map<string, { title: string; correct: number; total: number }>();
    for (const ea of exam.examAnswers) {
      const moduleId = ea.question.module.id;
      if (!moduleScores.has(moduleId)) {
        moduleScores.set(moduleId, {
          title: ea.question.module.title,
          correct: 0,
          total: 0,
        });
      }
      const entry = moduleScores.get(moduleId) ?? {
        title: ea.question.module.title,
        correct: 0,
        total: 0,
      };
      entry.total++;
      if (ea.questionCorrect) {
        entry.correct++;
      }
    }

    return {
      examId: exam.id,
      attemptNumber: exam.attemptNumber,
      score: exam.score,
      passingScore: exam.passingScore,
      passed: exam.status === ExamStatus.PASSED,
      status: exam.status,
      startedAt: exam.startedAt,
      submittedAt: exam.submittedAt,
      /**
       * Empty until grading has run, for the same reason the score is null.
       * Before grading, `questionCorrect` is null on every answer, so every
       * module would read "0 correct of N" - a verdict, and a false one, about
       * somebody's certification.
       */
      breakdown: graded
        ? Array.from(moduleScores.values()).map((m) => ({
            module: m.title,
            correct: m.correct,
            total: m.total,
            percentage: m.total > 0 ? Math.round((m.correct / m.total) * 100) : 0,
          }))
        : [],
    };
  }

  // ----- History ---------------------------
  async getExamHistory(userId: string) {
    // Non-throwing lookup: a CANDIDATE-status user just has an empty history.
    const candidate = await this.findCandidateByUserIdOrThrow(userId);
    const exams = await this.prisma.kbsExam.findMany({
      where: { candidateId: candidate.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        attemptNumber: true,
        score: true,
        passingScore: true,
        status: true,
        startedAt: true,
        submittedAt: true,
        scheduledAt: true,
        createdAt: true,
      },
    });
    return {
      candidateId: candidate.id,
      totalAttempts: exams.length,
      maxAttempts: candidate.maxAttempts,
      history: exams,
    };
  }

  // ----- Reschedule Exam ---------------------------
  async rescheduleExam(userId: string, examId: string, scheduledAt: Date) {
    const candidate = await this.requireVerifiedCandidateByUserIdOrThrow(userId);
    const exam = await this.findExamOrThrow(examId);

    if (exam.candidateId !== candidate.id) {
      throw new ForbiddenException(this.t('kbs.exam.notYours'));
    }
    if (exam.status !== ExamStatus.SCHEDULED) {
      throw new BadRequestException(
        this.t('kbs.exam.cannotReschedule', undefined, { status: exam.status }),
      );
    }

    return this.prisma.kbsExam.update({
      where: { id: examId },
      data: { scheduledAt },
    });
  }

  // ----- Admin ---------------------------
  async cancelExam(examId: string, dto: CancelExamDto) {
    const exam = await this.findExamOrThrow(examId);

    if (![ExamStatus.SCHEDULED, ExamStatus.IN_PROGRESS].includes(exam.status as ExamStatus)) {
      throw new BadRequestException(
        this.t('kbs.exam.cannotCancel', undefined, { status: exam.status }),
      );
    }

    return this.prisma.kbsExam.update({
      where: { id: examId },
      data: {
        status: ExamStatus.CANCELLED,
        cancelReason: dto.reason,
      },
    });
  }

  async resetAttempts(candidateId: string): Promise<{ message: string }> {
    const candidate = await this.prisma.kbsCandidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate) {
      throw new NotFoundException(this.t('kbs.candidate.notFound', undefined, { id: candidateId }));
    }

    await this.prisma.kbsCandidate.update({
      where: { id: candidateId },
      data: {
        currentCycle: { increment: 1 },
        ...(candidate.status === CandidateStatus.FAILED && {
          status: CandidateStatus.EXAM_PENDING,
        }),
      },
    });

    this.logger.log('Exam attempts reset %o', { candidateId });
    return { message: this.t('kbs.exam.attemptsReset') };
  }

  async findAllExams(query: PaginationQuery & { status?: ExamStatus }) {
    const { page, limit, sort, order, status } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    const [exams, total] = await this.prisma.$transaction([
      this.prisma.kbsExam.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: { candidate: { select: { id: true, userId: true } } },
      }),
      this.prisma.kbsExam.count({ where }),
    ]);

    const users = await this.usersService.findManyByIds(exams.map((e) => e.candidate.userId));
    const userById = new Map(users.map((u) => [u.id, u]));

    const data = exams.map((e) => {
      const u = userById.get(e.candidate.userId);
      return {
        id: e.id,
        candidateId: e.candidate.id,
        candidateName: u ? `${u.firstName} ${u.lastName}`.trim() : '',
        attemptNumber: e.attemptNumber,
        status: e.status,
        score: e.score,
        scheduledAt: e.scheduledAt,
        startedAt: e.startedAt,
        submittedAt: e.submittedAt,
      };
    });

    return buildPaginatedResponse(data, total, page, limit);
  }

  // ----- Exam Grading - BullMQ ---------------------------
  async gradeExam(examId: string): Promise<{ score: number; passed: boolean }> {
    const exam = await this.prisma.kbsExam.findUnique({
      where: { id: examId },
      include: {
        examAnswers: {
          include: {
            selections: {
              include: { answer: { select: { id: true, isCorrect: true } } },
            },
            question: {
              include: { answers: { select: { id: true, isCorrect: true } } },
            },
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(this.t('kbs.exam.notFound', undefined, { id: examId }));
    }

    let correctCount = 0;

    for (const ea of exam.examAnswers) {
      const correctAnswerIds = new Set(
        ea.question.answers.filter((a) => a.isCorrect).map((a) => a.id),
      );
      const selectedIds = new Set(ea.selections.map((s) => s.answer.id));

      // Fully correct: selected set must exactly equal the correct set (no extras, no omissions)
      const isQuestionCorrect =
        correctAnswerIds.size === selectedIds.size &&
        [...correctAnswerIds].every((id) => selectedIds.has(id));

      if (isQuestionCorrect) correctCount++;

      // Snapshot wasCorrect per selection and mark the slot result
      await this.prisma.$transaction([
        ...ea.selections.map((s) =>
          this.prisma.kbsExamAnswerSelection.update({
            where: { id: s.id },
            data: { wasCorrect: s.answer.isCorrect },
          }),
        ),
        this.prisma.kbsExamAnswer.update({
          where: { id: ea.id },
          data: { questionCorrect: isQuestionCorrect },
        }),
      ]);
    }

    const totalQuestions = exam.totalQuestions || exam.examAnswers.length;
    // I21 - capped as a second barrier. With answers accepted only on served
    // questions it never fires; a barrier that never fires is the point.
    const score =
      totalQuestions > 0 ? Math.min(100, Math.round((correctCount / totalQuestions) * 100)) : 0;
    const passed = score >= exam.passingScore;

    await this.prisma.kbsExam.update({
      where: { id: examId },
      data: {
        score,
        status: passed ? ExamStatus.PASSED : ExamStatus.FAILED,
      },
    });

    // Passing earns EXAM_PASSED. `certifiedAt` belongs to issuance, not to a
    // score: it is the date on the document, and there is no document yet.
    await this.prisma.kbsCandidate.update({
      where: { id: exam.candidateId },
      data: {
        status: passed ? CandidateStatus.EXAM_PASSED : CandidateStatus.FAILED,
      },
    });

    this.logger.log('Exam graded %o', {
      examId,
      candidateId: exam.candidateId,
      score,
      passed,
    });

    return { score, passed };
  }

  // ----- Admin: Exam Question CRUD (Dedicated Pool) ---------------------------
  async createExamQuestion(dto: CreateExamQuestionDto) {
    const mod = await this.prisma.kbsModule.findUnique({
      where: { id: dto.moduleId },
    });
    if (!mod)
      throw new NotFoundException(this.t('kbs.module.notFound', undefined, { id: dto.moduleId }));

    const question = await this.prisma.kbsExamQuestion.create({
      data: {
        text: dto.text,
        type: dto.type,
        moduleId: dto.moduleId,
        answers: {
          create: dto.answers.map((a) => ({
            text: a.text,
            isCorrect: a.isCorrect,
          })),
        },
      },
      include: { answers: true },
    });

    return question;
  }

  async updateExamQuestion(id: string, dto: UpdateExamQuestionDto) {
    if (dto.answers) {
      return this.prisma.$transaction(async (tx) => {
        await tx.kbsExamQuestionAnswer.deleteMany({
          where: { questionId: id },
        });
        return tx.kbsExamQuestion.update({
          where: { id },
          data: {
            ...(dto.text !== undefined && { text: dto.text }),
            ...(dto.type !== undefined && { type: dto.type }),
            ...(dto.moduleId !== undefined && { moduleId: dto.moduleId }),
            answers: { create: dto.answers },
          },
          include: {
            answers: true,
            module: { select: { id: true, title: true } },
          },
        });
      });
    }
    return this.prisma.kbsExamQuestion.update({
      where: { id },
      data: {
        ...(dto.text !== undefined && { text: dto.text }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.moduleId !== undefined && { moduleId: dto.moduleId }),
      },
      include: { answers: true, module: { select: { id: true, title: true } } },
    });
  }

  async deleteExamQuestion(id: string) {
    return this.prisma.kbsExamQuestion.delete({ where: { id } });
  }

  async findAllExamQuestions() {
    return this.prisma.kbsExamQuestion.findMany({
      include: { answers: true, module: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ----- Private Helpers ---------------------------
  private async findCandidateByUserIdOrThrow(userId: string) {
    const candidate = await this.prisma.kbsCandidate.findUnique({
      where: { userId },
    });
    if (!candidate) throw new NotFoundException(this.t('kbs.exam.notEnrolled'));
    return candidate;
  }

  private async findExamOrThrow(examId: string) {
    const exam = await this.prisma.kbsExam.findUnique({
      where: { id: examId },
    });
    if (!exam) throw new NotFoundException(this.t('kbs.exam.notFound', undefined, { id: examId }));
    return exam;
  }

  private assertExamNotExpired(exam: { startedAt: Date | null; durationMinutes: number }) {
    if (!exam.startedAt) return;
    const expiresAt = new Date(exam.startedAt.getTime() + exam.durationMinutes * 60000);
    if (new Date() > expiresAt) {
      throw new BadRequestException(this.t('kbs.exam.timeExpired'));
    }
  }

  private t(key: string, lang = 'fr', args?: Record<string, unknown>): string {
    return this.i18n.translate(key, { lang, args }) as string;
  }

  private async checkEligibilityRules(
    candidate: {
      id: string;
      maxAttempts: number;
      retakeCooldownDays: number;
      currentCycle: number;
    },
    isRenewal: boolean,
  ) {
    const base = await this.buildBaseEligibility(candidate);

    /**
     * I36 - eligibility ANSWERS the question; it does not refuse to consider it.
     *
     * The pool is scoped to the active course here as it is in the draw, but a
     * shortfall is a reason the candidate is told, not a 503. "Can I sit an
     * exam" has an honest answer on an environment with no course configured,
     * and that answer is "no, and here is why". The hard refusal belongs to
     * `startExam`, where a draw would otherwise come from nowhere.
     */
    const poolShortfall = await this.examPoolShortfall();
    if (poolShortfall) {
      return {
        ...base,
        eligible: false,
        reason: poolShortfall,
        nextAttemptAt: null,
        activeExamId: null,
      };
    }

    // Check for active exam
    const activeExam = await this.prisma.kbsExam.findFirst({
      where: {
        candidateId: candidate.id,
        status: { in: [ExamStatus.SCHEDULED, ExamStatus.IN_PROGRESS] },
      },
      select: { id: true },
    });

    if (activeExam) {
      return {
        ...base,
        eligible: false,
        reason: this.t('kbs.exam.activeExam'),
        nextAttemptAt: null,
        activeExamId: activeExam.id,
      };
    }

    if (base.attemptsUsed >= candidate.maxAttempts) {
      return {
        ...base,
        eligible: false,
        reason: this.t('kbs.exam.maxAttempts', undefined, {
          max: candidate.maxAttempts,
        }),
        nextAttemptAt: null,
        activeExamId: null,
      };
    }

    // Check cooldown after failure within the current reset cycle
    const lastFailed = await this.prisma.kbsExam.findFirst({
      where: {
        candidateId: candidate.id,
        cycle: candidate.currentCycle,
        status: ExamStatus.FAILED,
      },
      orderBy: { submittedAt: 'desc' },
      select: { submittedAt: true },
    });

    if (lastFailed?.submittedAt) {
      const cooldownEnd = new Date(lastFailed.submittedAt);
      cooldownEnd.setDate(cooldownEnd.getDate() + candidate.retakeCooldownDays);
      if (new Date() < cooldownEnd) {
        return {
          ...base,
          eligible: false,
          reason: this.t('kbs.exam.cooldownActive', undefined, {
            date: DateTime.fromJSDate(cooldownEnd).toRelative({
              base: DateTime.now(),
            }),
          }),
          nextAttemptAt: cooldownEnd.toISOString(),
          activeExamId: null,
        };
      }
    }

    if (!isRenewal) {
      /**
       * Both sides count the ACTIVE course, and both matter.
       *
       * I36 scoped the exam draw and named this line beside it. The KCA1 switch
       * is what made it bite: dev holds six modules - four KCA1 parcours and two
       * demonstration ones - so a candidate who had passed all four KCA1
       * quizzes was told "Formation incomplete : 4/6 modules termines" and
       * could never sit the exam. Training worked; certification was
       * unreachable; nothing looked broken.
       *
       * Scoping only the denominator would be worse than leaving both. With a
       * total of 4 and an unfiltered numerator, two KCA1 modules plus two
       * demonstration ones also make 4, and that candidate walks into a KCA1
       * exam having passed half of KCA1. One bug refuses somebody; that one
       * certifies them.
       *
       * This is the shape `checkAndTransitionToExamPending` already uses, which
       * is why the two now agree about what "finished" means.
       */
      const settings = await readActiveCourse(this.prisma);
      const activeCourseId = settings?.activeCourseId;
      if (!activeCourseId) {
        return {
          ...base,
          eligible: false,
          reason: this.t('kbs.exam.noActiveCourse'),
          nextAttemptAt: null,
          activeExamId: null,
        };
      }

      const totalModules = await this.prisma.kbsModule.count({
        where: { courseId: activeCourseId },
      });
      const completedModules = await this.prisma.kbsCandidateProgress.count({
        where: { candidateId: candidate.id, passed: true, module: { courseId: activeCourseId } },
      });
      if (completedModules < totalModules) {
        return {
          ...base,
          eligible: false,
          reason: this.t('kbs.exam.trainingIncomplete', undefined, {
            completed: completedModules,
            total: totalModules,
          }),
          nextAttemptAt: null,
          activeExamId: null,
        };
      }
    }

    return {
      ...base,
      eligible: true,
      reason: null,
      nextAttemptAt: null,
      activeExamId: null,
    };
  }

  private async buildBaseEligibility(candidate: {
    id: string;
    maxAttempts: number;
    retakeCooldownDays: number;
    currentCycle: number;
  }) {
    const completedAttempts = await this.prisma.kbsExam.count({
      where: {
        candidateId: candidate.id,
        cycle: candidate.currentCycle,
        status: {
          in: [ExamStatus.PASSED, ExamStatus.FAILED, ExamStatus.SUBMITTED],
        },
      },
    });
    return {
      attemptsUsed: completedAttempts,
      attemptsLeft: Math.max(0, candidate.maxAttempts - completedAttempts),
      maxAttempts: candidate.maxAttempts,
      cooldownDays: candidate.retakeCooldownDays,
    };
  }

  private async requireVerifiedCandidateByUserIdOrThrow(userId: string) {
    const candidate = await this.findCandidateByUserIdOrThrow(userId);
    if (candidate.status === CandidateStatus.CANDIDATE) {
      throw new ForbiddenException(this.t('kbs.enrollment.awaitingVerification'));
    }
    return candidate;
  }

  /**
   * The pool must be able to fill an exam of the configured length, not merely
   * be non-empty.
   *
   * The old check was `poolSize === 0`. With a pool of 5 the draw is
   * `.slice(0, 20)` -> 5 questions, `totalQuestions` is set from
   * `shuffled.length`, and the score divides by that. The arithmetic stays
   * internally honest, which is exactly what makes it dangerous: there is no
   * wrong number anywhere to notice. The certification exam simply shrinks, a
   * 4/5 becomes 80% and the candidate is certified. Certification either runs at
   * its stated length or it does not run.
   */
  private async ensureQuestionPoolAvailable() {
    const settings = await readActiveCourse(this.prisma);
    const required = settings?.examQuestionCount ?? DEFAULT_EXAM_QUESTION_COUNT;
    const poolSize = await this.prisma.kbsExamQuestion.count({
      where: { module: { courseId: this.activeCourseIdOrThrow(settings) } },
    });

    if (poolSize < required) {
      throw new ServiceUnavailableException(
        `${this.t('kbs.exam.noQuestions')} (pool ${poolSize}, requis ${required})`,
      );
    }
  }

  /**
   * The same reckoning as the guard, as a REASON rather than an exception.
   *
   * Returns null when the active course has questions enough to sit an exam,
   * and a sentence for the candidate when it does not. One place computes it so
   * the two paths cannot disagree about what "enough" means.
   */
  private async examPoolShortfall(): Promise<string | null> {
    const settings = await readActiveCourse(this.prisma);
    const activeCourseId = settings?.activeCourseId;
    if (!activeCourseId) {
      return this.t('kbs.exam.noActiveCourse');
    }

    const required = settings?.examQuestionCount ?? DEFAULT_EXAM_QUESTION_COUNT;
    const poolSize = await this.prisma.kbsExamQuestion.count({
      where: { module: { courseId: activeCourseId } },
    });

    return poolSize < required ? this.t('kbs.exam.noQuestions') : null;
  }

  /**
   * I36 - the course an exam belongs to, and why it comes from the settings.
   *
   * `KbsExam` carries no course reference: only a candidate, a cycle and an
   * attempt number. The course a candidate is studying is the active one, which
   * is the same source `getMyOverview` and `checkAndTransitionToExamPending`
   * already read.
   *
   * Absent, this refuses rather than falling back to every question in the
   * database. An exam drawn from "no course in particular" is precisely the
   * unscoped read this fixes: on dev it would have drawn 20 demonstration
   * questions for a KCA1 candidate, and every mechanical step would have passed
   * while the candidate was examined on material they never studied.
   */
  private activeCourseIdOrThrow(settings: { activeCourseId?: string | null } | null): string {
    const activeCourseId = settings?.activeCourseId;
    if (!activeCourseId) {
      throw new ServiceUnavailableException(
        `${this.t('kbs.exam.noQuestions')} (aucun cours actif: kbsSettings.activeCourseId est vide)`,
      );
    }
    return activeCourseId;
  }

  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
