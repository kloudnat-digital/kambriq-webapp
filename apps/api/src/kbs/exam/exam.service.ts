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
import { UsersService } from '../../core/users/users.service';

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

    // Certified but certificate expired → renewal path
    if (candidate.status === CandidateStatus.CERTIFIED) {
      const cert = await this.prisma.kbsCertificate.findUnique({
        where: { candidateId: candidate.id },
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

    const settings = await this.prisma.kbsSettings.findFirst();
    const questionCount = settings?.examQuestionCount ?? DEFAULT_EXAM_QUESTION_COUNT;

    const allQuestions = await this.prisma.kbsExamQuestion.findMany({
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
    await this.prisma.kbsExam.update({
      where: { id: exam.id },
      data: {
        status: ExamStatus.IN_PROGRESS,
        startedAt,
        totalQuestions: shuffled.length,
      },
    });

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
      const slot = await tx.kbsExamAnswer.upsert({
        where: { examId_questionId: { examId, questionId: dto.questionId } },
        create: {
          examId,
          questionId: dto.questionId,
          flagged: dto.flagged ?? false,
        },
        update: { flagged: dto.flagged ?? false, answeredAt: new Date() },
      });

      // Replace selections atomically (handles both SINGLE and MULTIPLE)
      await tx.kbsExamAnswerSelection.deleteMany({
        where: { examAnswerId: slot.id },
      });
      if (dto.answerIds.length > 0) {
        await tx.kbsExamAnswerSelection.createMany({
          data: dto.answerIds.map((answerId) => ({
            examAnswerId: slot.id,
            answerId,
          })),
        });
      }

      return slot;
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

    // Save final answers - same atomic slot+selection logic as saveAnswer
    for (const answer of dto.answers) {
      await this.prisma.$transaction(async (tx) => {
        const slot = await tx.kbsExamAnswer.upsert({
          where: {
            examId_questionId: { examId, questionId: answer.questionId },
          },
          create: { examId, questionId: answer.questionId },
          update: { answeredAt: new Date() },
        });

        await tx.kbsExamAnswerSelection.deleteMany({
          where: { examAnswerId: slot.id },
        });
        if (answer.answerIds.length > 0) {
          await tx.kbsExamAnswerSelection.createMany({
            data: answer.answerIds.map((answerId) => ({
              examAnswerId: slot.id,
              answerId,
            })),
          });
        }
      });
    }

    await this.prisma.kbsExam.update({
      where: { id: examId },
      data: {
        status: ExamStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    // Enqueue grading job
    await this.kbsQueue.add(
      KBS_JOBS.GRADE_EXAM,
      {
        examId,
        candidateId: candidate.id,
        userId: candidate.userId,
      },
      { jobId: `grade-exam-${examId}` },
    );
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

    if (![ExamStatus.PASSED, ExamStatus.FAILED].includes(exam.status as ExamStatus)) {
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
      breakdown: Array.from(moduleScores.values()).map((m) => ({
        module: m.title,
        correct: m.correct,
        total: m.total,
        percentage: m.total > 0 ? Math.round((m.correct / m.total) * 100) : 0,
      })),
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
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = score >= exam.passingScore;

    await this.prisma.kbsExam.update({
      where: { id: examId },
      data: {
        score,
        status: passed ? ExamStatus.PASSED : ExamStatus.FAILED,
      },
    });

    await this.prisma.kbsCandidate.update({
      where: { id: exam.candidateId },
      data: {
        status: passed ? CandidateStatus.CERTIFIED : CandidateStatus.FAILED,
        ...(passed && { certifiedAt: new Date() }),
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
    await this.ensureQuestionPoolAvailable();

    const base = await this.buildBaseEligibility(candidate);

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
      // Check all modules completed
      const totalModules = await this.prisma.kbsModule.count();
      const completedModules = await this.prisma.kbsCandidateProgress.count({
        where: { candidateId: candidate.id, passed: true },
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

  private async ensureQuestionPoolAvailable() {
    const poolSize = await this.prisma.kbsExamQuestion.count();
    if (poolSize === 0) throw new ServiceUnavailableException(this.t('kbs.exam.noQuestions'));
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
