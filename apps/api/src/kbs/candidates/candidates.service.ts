import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from '../../core/users/users.service';
import { KbsPrismaService } from '../prisma/kbs-prisma.service';
import {
  EnrollDto,
  SubmitQuizDto,
  UpdateCandidateStatusDto,
} from './dto/candidate.dto';
import {
  buildPaginatedResponse,
  CandidateStatus,
  MODULE_PASSING_SCORE,
  PaginationQuery,
  RoleCode,
  STATUS_TRANSITIONS,
} from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class KbsCandidatesService {
  private readonly logger = new Logger(KbsCandidatesService.name);

  constructor(
    private readonly prisma: KbsPrismaService,
    private readonly i18n: I18nService,
    private readonly userService: UsersService,
  ) {}

  // ----- Enroll ------------------------------------------
  async enroll(userId: string, dto: EnrollDto) {
    const existing = await this.prisma.kbsCandidate.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException(this.t('kbs.enrollment.alreadyEnrolled'));
    }

    const candidate = await this.prisma.kbsCandidate.create({
      data: {
        userId,
        sponsorCode: dto.sponsorCode,
        status: CandidateStatus.CANDIDATE,
      },
    });

    await this.userService.addRole(userId, RoleCode.CANDIDATE_KBS);

    this.logger.log(`User ${userId} enrolled in KBS`, {
      sponsor: dto.sponsorCode,
    });
    return candidate;
  }

  // ----- Candidate Profile & Progress --------------------
  async getMyProfile(userId: string) {
    const candidate = await this.prisma.kbsCandidate.findUnique({
      where: { userId },
      include: {
        progress: {
          include: {
            module: { select: { id: true, title: true, order: true } },
          },
          orderBy: { module: { order: 'asc' } },
        },
        certificate: {
          select: { kcaNumber: true, issueDate: true, validUntil: true },
        },
      },
    });

    if (!candidate) {
      throw new NotFoundException(this.t('kbs.enrollment.notEnrolled'));
    }

    // Calculate overall progress
    const totalModules = await this.prisma.kbsModule.count();
    const completedModules = candidate.progress.filter((p) => p.passed).length;
    const progressPercent =
      totalModules > 0
        ? Math.round((completedModules / totalModules) * 100)
        : 0;

    return {
      id: candidate.id,
      userId: candidate.userId,
      status: candidate.status,
      sponsorCode: candidate.sponsorCode,
      enrolledAt: candidate.enrolledAt,
      certifiedAt: candidate.certifiedAt,
      overallProgress: {
        completed: completedModules,
        total: totalModules,
        percent: progressPercent,
      },
      modules: candidate.progress.map((p) => ({
        moduleId: p.moduleId,
        moduleTitle: p.module.title,
        moduleOrder: p.module.order,
        score: p.score,
        passed: p.passed,
        completedAt: p.completedAt,
      })),
      certificate: candidate.certificate,
    };
  }

  // ----- Quiz Submission --------------------

  async submitQuiz(userId: string, moduleId: string, dto: SubmitQuizDto) {
    // Find Candidate
    const candidate = await this.findCandidateByUserIdOrThrow(userId);

    // Validate candidate is in training
    if (
      ![CandidateStatus.IN_TRAINING, CandidateStatus.CANDIDATE].includes(
        candidate.status as CandidateStatus,
      )
    ) {
      throw new ForbiddenException(
        this.t('kbs.exam.statusNotAllowed', undefined, {
          status: candidate.status,
        }),
      );
    }

    // Validate module exists
    const mod = await this.prisma.kbsModule.findUnique({
      where: { id: moduleId },
      include: { course: { select: { id: true } } },
    });
    if (!mod) throw new NotFoundException(`Module ${moduleId} not found`);

    // Check prerequisite: previous modules must be completed (ordered by order)
    const previousModules = await this.prisma.kbsModule.findMany({
      where: {
        courseId: mod.course.id,
        order: { lt: mod.order },
      },
      select: { id: true },
    });

    if (previousModules.length > 0) {
      const completedPrevious = await this.prisma.kbsCandidateProgress.count({
        where: {
          candidateId: candidate.id,
          moduleId: { in: previousModules.map((m) => m.id) },
          passed: true,
        },
      });

      if (completedPrevious < previousModules.length) {
        throw new ForbiddenException(this.t('kbs.module.prerequisiteNotMet'));
      }
    }

    // Enforce quiz attempt limit (quizMaxAttempts = 0 means unlimited)
    const settings = await this.prisma.kbsSettings.findFirst();
    const quizMaxAttempts = settings?.quizMaxAttempts ?? 0;
    if (quizMaxAttempts > 0) {
      const existingProgress = await this.prisma.kbsCandidateProgress.findUnique({
        where: { candidateId_moduleId: { candidateId: candidate.id, moduleId } },
        select: { attempts: true },
      });
      if ((existingProgress?.attempts ?? 0) >= quizMaxAttempts) {
        throw new ForbiddenException(
          this.t('kbs.quiz.maxAttemptsReached', undefined, {
            max: quizMaxAttempts,
          }),
        );
      }
    }

    // Fetch correct answers for this module's questions
    const questions = await this.prisma.kbsQuestion.findMany({
      where: { moduleId },
      include: { answers: { where: { isCorrect: true } } },
    });

    if (questions.length === 0) {
      throw new BadRequestException(this.t('kbs.exam.noQuestions'));
    }

    // Grade: exact-set match (handles both SINGLE and MULTIPLE question types)
    let correctCount = 0;
    for (const submission of dto.answers) {
      const question = questions.find((q) => q.id === submission.questionId);
      if (!question) continue; // Ignore invalid question IDs

      const correctAnswerIds = new Set(question.answers.map((a) => a.id));
      const selectedIds = new Set(submission.answerIds);

      const isCorrect =
        correctAnswerIds.size === selectedIds.size &&
        [...correctAnswerIds].every((id) => selectedIds.has(id));

      if (isCorrect) correctCount++;
    }

    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= MODULE_PASSING_SCORE;

    // Upsert progress record — always increment attempt counter
    await this.prisma.kbsCandidateProgress.upsert({
      where: {
        candidateId_moduleId: {
          candidateId: candidate.id,
          moduleId,
        },
      },
      create: {
        candidateId: candidate.id,
        moduleId,
        score,
        passed,
        attempts: 1,
        completedAt: passed ? new Date() : null,
      },
      update: {
        score,
        passed,
        attempts: { increment: 1 },
        completedAt: passed ? new Date() : null,
      },
    });

    if (passed && candidate.status === CandidateStatus.IN_TRAINING) {
      await this.checkAndTransitionToExamPending(candidate.id);
    }

    this.logger.log('Quiz submitted', {
      userId,
      moduleId,
      score,
      result: passed ? 'PASSED' : 'FAILED',
    });

    return {
      moduleId,
      score,
      passed,
      correctCount,
      totalQuestions: questions.length,
      passingScore: MODULE_PASSING_SCORE,
      attemptsUsed: (settings?.quizMaxAttempts ?? 0) > 0
        ? ((await this.prisma.kbsCandidateProgress.findUnique({
            where: { candidateId_moduleId: { candidateId: candidate.id, moduleId } },
            select: { attempts: true },
          }))?.attempts ?? 1)
        : null,
      maxAttempts: quizMaxAttempts > 0 ? quizMaxAttempts : null,
    };
  }

  // ----- Admin: List & Manage Candidates --------------------------
  async findAll(query: PaginationQuery, status?: string, search?: string) {
    const { page, limit, sort, order } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    // Search by userId (cross-module name search would need Core call)
    if (search) where.userId = { contains: search, mode: 'insensitive' };

    const [candidates, total] = await this.prisma.$transaction([
      this.prisma.kbsCandidate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          progress: { select: { passed: true } },
          certificate: { select: { kcaNumber: true } },
        },
      }),
      this.prisma.kbsCandidate.count({ where }),
    ]);

    const data = candidates.map((c) => ({
      id: c.id,
      userId: c.userId,
      status: c.status,
      sponsorCode: c.sponsorCode,
      enrolledAt: c.enrolledAt,
      certifiedAt: c.certifiedAt,
      modulesCompleted: c.progress.filter((p) => p.passed).length,
      kcaNumber: c.certificate?.kcaNumber || null,
    }));

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findById(candidateId: string) {
    const candidate = await this.prisma.kbsCandidate.findUnique({
      where: { id: candidateId },
      include: {
        progress: {
          include: {
            module: { select: { id: true, title: true, order: true } },
          },
          orderBy: { module: { order: 'asc' } },
        },
        exams: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            attemptNumber: true,
            score: true,
            status: true,
            startedAt: true,
            submittedAt: true,
          },
        },
        certificate: true,
      },
    });

    if (!candidate)
      throw new NotFoundException(
        this.t('kbs.certificate.candidateNotFound', undefined, {
          id: candidateId,
        }),
      );
    return candidate;
  }

  async updateStatus(
    candidateId: string,
    adminUserId: string,
    dto: UpdateCandidateStatusDto,
  ) {
    const candidate = await this.prisma.kbsCandidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate) {
      throw new NotFoundException(
        this.t('kbs.certificate.candidateNotFound', undefined, {
          id: candidateId,
        }),
      );
    }

    const allowed =
      STATUS_TRANSITIONS[candidate.status as CandidateStatus] || [];
    if (!allowed.includes(dto.status as CandidateStatus)) {
      throw new BadRequestException(
        `Cannot transition from "${candidate.status}" to "${dto.status}". Allowed: [${allowed.join(', ')}]`,
      );
    }

    const updateData: Record<string, unknown> = { status: dto.status };
    if (dto.status === CandidateStatus.CERTIFIED) {
      updateData.certifiedAt = new Date();
    }
    const updated = await this.prisma.kbsCandidate.update({
      where: { id: candidateId },
      data: updateData,
    });

    // Cross module side effect
    if (dto.status === CandidateStatus.CERTIFIED) {
      await this.userService.addRole(
        candidate.userId,
        RoleCode.KCA_CERTIFIED,
        adminUserId,
      );
      this.logger.log(
        `KCA role granted to user ${candidate.userId} by admin ${adminUserId}`,
      );
    }

    this.logger.log('Candidate status updated', {
      candidateId,
      newStatus: dto.status,
      updatedBy: adminUserId,
    });

    return updated;
  }

  // ----- Cross Module Interface ----------------------------------
  /**
   * Used by KAMNET to check if a user has an active (non-expired) KBS certification.
   * Returns false if the candidate is not certified or if the certificate has expired.
   */
  async isUserCertified(userId: string): Promise<boolean> {
    const candidate = await this.prisma.kbsCandidate.findUnique({
      where: { userId },
      select: {
        status: true,
        certificate: { select: { validUntil: true } },
      },
    });

    if (candidate?.status !== CandidateStatus.CERTIFIED) return false;

    // If no certificate has been issued yet the status alone is not enough
    if (!candidate.certificate) return false;

    return candidate.certificate.validUntil > new Date();
  }

  async findByUserId(userId: string) {
    return await this.prisma.kbsCandidate.findUnique({
      where: { userId },
    });
  }

  // ----- Private Helpers ------------------------------------------
  private async findCandidateByUserIdOrThrow(userId: string) {
    const candidate = await this.prisma.kbsCandidate.findUnique({
      where: { userId },
    });
    if (!candidate) {
      throw new NotFoundException(this.t('kbs.enrollment.notEnrolled'));
    }
    return candidate;
  }

  private async checkAndTransitionToExamPending(candidateId: string) {
    const totalModules = await this.prisma.kbsModule.count();
    const completedModules = await this.prisma.kbsCandidateProgress.count({
      where: { candidateId, passed: true },
    });

    if (completedModules >= totalModules && totalModules > 0) {
      await this.prisma.kbsCandidate.update({
        where: { id: candidateId },
        data: { status: CandidateStatus.EXAM_PENDING },
      });
      this.logger.log(
        `Candidate ${candidateId} auto-transitioned to ${CandidateStatus.EXAM_PENDING}`,
      );
    }
  }

  private t(key: string, lang = 'fr', args?: Record<string, unknown>): string {
    return this.i18n.translate(key, { lang, args }) as string;
  }
}
