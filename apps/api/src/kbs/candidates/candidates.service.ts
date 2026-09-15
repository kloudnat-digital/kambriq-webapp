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
  CvUploadUrlDto,
  EnrollDto,
  SubmitQuizDto,
  UpdateCandidateStatusDto,
} from './dto/candidate.dto';
import {
  buildPaginatedResponse,
  CandidateStatus,
  DEFAULT_LANGUAGE,
  EmailService,
  DEFAULT_QUIZ_QUESTION_COUNT,
  MODULE_PASSING_SCORE,
  PaginationQuery,
  RoleCode,
  STATUS_TRANSITIONS,
  StorageService,
} from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';
import { CorePrismaService } from '../../core/prisma/core-prisma.service';

@Injectable()
export class KbsCandidatesService {
  private readonly logger = new Logger(KbsCandidatesService.name);

  constructor(
    private readonly prisma: KbsPrismaService,
    private readonly corePrisma: CorePrismaService,
    private readonly i18n: I18nService,
    private readonly userService: UsersService,
    private readonly storage: StorageService,
    private readonly emailService: EmailService,
  ) {}

  // ----- Get CV upload URL ---------------------------------------
  async getCvUploadUrl(userId: string, dto: CvUploadUrlDto) {
    const timestamp = Date.now();
    const name = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = this.storage.buildKey('kbs', 'candidates', userId, 'cv', `${timestamp}-${name}`);
    return this.storage.getUploadUrl(key, dto.contentType);
  }

  // ----- Enroll ------------------------------------------
  async enroll(userId: string, dto: EnrollDto) {
    const existing = await this.prisma.kbsCandidate.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException(this.t('kbs.enrollment.alreadyEnrolled'));
    }

    const user = await this.corePrisma.user.findUnique({
      where: { id: userId },
      include: { profile: { select: { idDocumentUrls: true } } },
    });

    if (!user) {
      throw new NotFoundException(this.t('user.notFound', DEFAULT_LANGUAGE, { id: userId }));
    }

    if (!user.profile || user.profile.idDocumentUrls.length === 0) {
      throw new BadRequestException(this.t('kbs.enrollment.idRequired'));
    }

    const candidate = await this.prisma.kbsCandidate.create({
      data: {
        userId,
        cvUrl: dto.cvUrl,
        sponsorCode: dto.sponsorCode,
        engagementAcceptedAt: new Date(),
        status: CandidateStatus.CANDIDATE,
      },
    });

    await this.userService.addRole(userId, RoleCode.CANDIDATE_KBS);

    const lang = user.preferredLanguage || DEFAULT_LANGUAGE;
    await this.emailService.send({
      to: user.email,
      template: 'kbsEnrollmentReceived',
      lang,
      args: {
        firstName: user.firstName,
      },
    });

    this.logger.log(`User ${userId} enrolled in KBS %o`, {
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
      totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

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

  // ----- Candidate Progress Overview --------------------

  async getMyOverview(userId: string) {
    const candidate = await this.prisma.kbsCandidate.findUnique({
      where: { userId },
      include: {
        progress: true,
        lessonCompletions: { select: { lessonId: true } },
        certificate: { select: { kcaNumber: true } },
      },
    });

    if (!candidate) {
      throw new NotFoundException(this.t('kbs.enrollment.notEnrolled'));
    }
    if (candidate.status === CandidateStatus.CANDIDATE) {
      throw new ForbiddenException(this.t('kbs.enrollment.awaitingVerification'));
    }

    const settings = await this.prisma.kbsSettings.findFirst();
    const activeCourseId = settings.activeCourseId ?? null;

    if (!activeCourseId) {
      return {
        candidate: {
          id: candidate.id,
          status: candidate.status,
          sponsorCode: candidate.sponsorCode,
          enrolledAt: candidate.enrolledAt,
          certifiedAt: candidate.certifiedAt,
          currentCycle: candidate.currentCycle,
        },
        course: null,
        overall: {
          percent: 0,
          modulesDone: 0,
          modulesTotal: 0,
          currentModuleOrder: null,
          nextAction: 'lesson' as const,
        },
        modules: [],
      };
    }

    const course = await this.prisma.kbsCourse.findUnique({
      where: { id: activeCourseId },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              select: { id: true, order: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(
        this.t('kbs.course.notFound', DEFAULT_LANGUAGE, { id: activeCourseId }),
      );
    }

    const completedLessonIdSet = new Set(candidate.lessonCompletions.map((c) => c.lessonId));
    const progressByModuleId = new Map(candidate.progress.map((p) => [p.moduleId, p]));

    let previousPassed = true;

    const moduleViews = course.modules.map((mod) => {
      const p = progressByModuleId.get(mod.id);
      const passed = !!p?.passed;

      const moduleLessonIds = mod.lessons.map((l) => l.id);
      const completedInModule = moduleLessonIds.filter((id) => completedLessonIdSet.has(id));
      const lessonsCompleted = completedInModule.length;
      const lessonsCount = mod.lessons.length;
      const allLessonsDone = lessonsCount > 0 && lessonsCompleted === lessonsCount;

      const firstUncompleted = mod.lessons.find((l) => !completedLessonIdSet.has(l.id));
      const currentLessonOrder = firstUncompleted?.order ?? null;

      let status: 'locked' | 'in_progress' | 'completed';
      if (passed) status = 'completed';
      else if (!previousPassed) status = 'locked';
      else status = 'in_progress';

      const view = {
        id: mod.id,
        order: mod.order,
        title: mod.title,
        lessonsCount,
        lessonsCompleted,
        currentLessonOrder,
        status,
        quiz: {
          unlocked: status !== 'locked' && allLessonsDone,
          attempts: p?.attempts ?? 0,
          score: p?.score ?? 0,
          passed,
        },
      };

      previousPassed = passed;
      return view;
    });

    const modulesTotal = moduleViews.length;
    const modulesDone = moduleViews.filter((m) => m.status === 'completed').length;
    const percent = modulesTotal > 0 ? Math.round((modulesDone / modulesTotal) * 100) : 0;

    const firstNotDone = moduleViews.find((m) => m.status !== 'completed');
    const currentModuleOrder = firstNotDone?.order ?? null;

    let nextAction: 'lesson' | 'mcq' | 'exam' | 'awaiting-certificate' | 'certified';

    if (candidate.status === CandidateStatus.CERTIFIED) {
      nextAction = 'certified';
    } else if (candidate.status === CandidateStatus.EXAM_PASSED) {
      // Distinct from 'certified' on purpose. The screen that renders this has
      // to be able to say "passed, certificate on its way" without inferring it
      // from a null certificate.
      nextAction = 'awaiting-certificate';
    } else if (modulesDone === modulesTotal && modulesTotal > 0) {
      nextAction = 'exam';
    } else if (firstNotDone) {
      nextAction =
        firstNotDone.lessonsCompleted === firstNotDone.lessonsCount &&
        firstNotDone &&
        firstNotDone.lessonsCompleted > 0
          ? 'mcq'
          : 'lesson';
    } else {
      nextAction = 'lesson';
    }

    return {
      candidate: {
        id: candidate.id,
        status: candidate.status,
        sponsorCode: candidate.sponsorCode,
        enrolledAt: candidate.enrolledAt,
        certifiedAt: candidate.certifiedAt,
        currentCycle: candidate.currentCycle,
      },
      course: {
        id: course.id,
        title: course.title,
        totalModules: modulesTotal,
      },
      overall: {
        percent,
        modulesDone,
        modulesTotal,
        currentModuleOrder,
        nextAction,
      },
      modules: moduleViews,
    };
  }

  // ----- Quiz Submission --------------------

  async submitQuiz(userId: string, moduleId: string, dto: SubmitQuizDto) {
    // Find Candidate
    const candidate = await this.requireVerifiedCandidateByUserIdOrThrow(userId);

    // Only IN_TRAINING candidates can submit quizzes (CANDIDATE was already
    // blocked by the gate above; EXAM_PENDING/CERTIFIED/FAILED are done with training).
    if (candidate.status !== CandidateStatus.IN_TRAINING) {
      throw new ForbiddenException(this.t('kbs.exam.notInTraining'));
    }

    // Validate module exists
    const mod = await this.prisma.kbsModule.findUnique({
      where: { id: moduleId },
      include: { course: { select: { id: true } } },
    });
    if (!mod)
      throw new NotFoundException(this.t('kbs.module.notFound', undefined, { id: moduleId }));

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

    /**
     * Grade over the questions that were asked, not over the module's pool.
     *
     * The score was `correctCount / questions.length`, where `questions` is
     * every question in the module. `findQuestionsForQuiz` serves
     * `quizQuestionCount` of them. With a pool of 30 and a quiz of 10, a
     * candidate who answered all ten correctly scored 10/30 = 33% and failed.
     * Nobody could pass a quiz, so nobody could reach the exam.
     *
     * It was invisible until B3 because the module pools held five questions:
     * the draw was `min(5, 10) = 5`, the pool was 5, and the denominator was
     * accidentally right. Seeding a real bank is what exposed it - the same
     * shape as the coverage denominator, an arithmetic that stays internally
     * consistent while measuring the wrong population.
     *
     * A submission that does not cover the served quiz is refused rather than
     * normalised. Scoring a partial submission out of the full quiz length
     * would be a guess about intent, and scoring it out of its own length would
     * let a client submit its one confident answer and score 100%.
     */
    const quizLength = settings?.quizQuestionCount ?? DEFAULT_QUIZ_QUESTION_COUNT;
    if (dto.answers.length !== quizLength) {
      throw new BadRequestException(
        `${this.t('kbs.quiz.incompleteSubmission')} (reçu ${dto.answers.length}, attendu ${quizLength})`,
      );
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

    const score = Math.round((correctCount / quizLength) * 100);
    const passed = score >= MODULE_PASSING_SCORE;

    // Upsert progress record - always increment attempt counter
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

    if (passed) {
      await this.checkAndTransitionToExamPending(candidate.id);
    }

    this.logger.log('Quiz submitted %o', {
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
      totalQuestions: quizLength,
      passingScore: MODULE_PASSING_SCORE,
      attemptsUsed:
        (settings?.quizMaxAttempts ?? 0) > 0
          ? ((
              await this.prisma.kbsCandidateProgress.findUnique({
                where: { candidateId_moduleId: { candidateId: candidate.id, moduleId } },
                select: { attempts: true },
              })
            )?.attempts ?? 1)
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

    const users = await this.userService.findManyByIds(candidates.map((c) => c.userId));
    const userById = new Map(users.map((u) => [u.id, u]));

    const data = candidates.map((c) => {
      const u = userById.get(c.userId);

      return {
        id: c.id,
        userId: c.userId,
        firstName: u?.firstName ?? null,
        lastName: u?.lastName ?? null,
        email: u?.email ?? null,
        status: c.status,
        sponsorCode: c.sponsorCode,
        enrolledAt: c.enrolledAt,
        certifiedAt: c.certifiedAt,
        modulesCompleted: c.progress.filter((p) => p.passed).length,
        kcaNumber: c.certificate?.kcaNumber || null,
      };
    });

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
            scheduledAt: true,
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

    const user = await this.userService.findById(candidate.userId);
    const idDocumentKeys = user.profile?.idDocumentUrls ?? [];

    const [idDocumentUrls, cvUrl] = await Promise.all([
      Promise.all(idDocumentKeys.map((k) => this.storage.getDownloadUrl(k))),
      candidate.cvUrl ? this.storage.getDownloadUrl(candidate.cvUrl) : Promise.resolve(null),
    ]);

    return {
      ...candidate,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      idVerificationStatus: user.profile?.idVerificationStatus ?? 'none',
      cvUrl,
      idDocumentUrls,
      progress: candidate.progress.map((p) => ({
        moduleId: p.moduleId,
        moduleOrder: p.module.order,
        moduleTitle: p.module.title,
        passed: p.passed,
        score: p.score,
        attempts: p.attempts,
      })),
    };
  }

  async updateStatus(candidateId: string, adminUserId: string, dto: UpdateCandidateStatusDto) {
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

    /**
     * I15 - certification is conferred by issuing the certificate, never by
     * setting a status. This endpoint set CERTIFIED and granted KCA_CERTIFIED
     * with no certificate behind it, so the platform treated as certified
     * somebody whose number `/verify-certificate` answered "non reconnu" for.
     */
    if (dto.status === CandidateStatus.CERTIFIED) {
      throw new BadRequestException(this.t('kbs.candidate.certifiedByIssuanceOnly'));
    }

    const allowed = STATUS_TRANSITIONS[candidate.status as CandidateStatus] || [];
    if (!allowed.includes(dto.status as CandidateStatus)) {
      throw new BadRequestException(
        this.t('kbs.candidate.invalidTransition', undefined, {
          from: candidate.status,
          to: dto.status,
          allowed: allowed.join(', '),
        }),
      );
    }

    const updated = await this.prisma.kbsCandidate.update({
      where: { id: candidateId },
      data: { status: dto.status },
    });

    this.logger.log('Candidate status updated %o', {
      candidateId,
      newStatus: dto.status,
      updatedBy: adminUserId,
    });

    return updated;
  }

  // ----- Cross Module Interface ----------------------------------
  /**
   * I15 - the one answer to "is this person certified".
   *
   * The certificate is the truth: it exists, it is not revoked, it has not
   * expired, and the candidate's status is CERTIFIED. The KCA_CERTIFIED role is
   * a projection of this - granted on issue, withdrawn on revocation and on
   * expiry - and is deliberately not consulted here.
   *
   * Revocation is read directly. The previous version read only `status` and
   * `validUntil`, and was right about a revoked certificate only because
   * `revokeCertificate` also resets the status: a side effect in another
   * service standing in for the fact itself.
   */
  async findActiveCertificate(
    userId: string,
  ): Promise<{ kcaNumber: string; validUntil: Date } | null> {
    const candidate = await this.prisma.kbsCandidate.findUnique({
      where: { userId },
      select: {
        status: true,
        certificate: { select: { kcaNumber: true, validUntil: true, revokedAt: true } },
      },
    });

    if (candidate?.status !== CandidateStatus.CERTIFIED) return null;

    const certificate = candidate.certificate;
    if (!certificate || certificate.revokedAt) return null;
    if (certificate.validUntil <= new Date()) return null;

    return { kcaNumber: certificate.kcaNumber, validUntil: certificate.validUntil };
  }

  /** Whether the user holds an active certificate. KAMNET asks this at submission and at approval. */
  async isUserCertified(userId: string): Promise<boolean> {
    return (await this.findActiveCertificate(userId)) !== null;
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
    const settings = await this.prisma.kbsSettings.findFirst();
    const activeCourseId = settings?.activeCourseId;
    if (!activeCourseId) {
      // Returning quietly here strands the candidate: they have passed every
      // module, the transition to EXAM_PENDING never happens, and no error
      // reaches them or the log. The state is recoverable by an admin, but only
      // once somebody knows to look. This is the one line that tells them.
      this.logger.error(
        'Candidate passed a module but no active course is configured, so the transition to EXAM_PENDING cannot run. Set kbsSettings.activeCourseId. %o',
        { candidateId },
      );
      return;
    }

    const totalModules = await this.prisma.kbsModule.count({ where: { courseId: activeCourseId } });
    const completedModules = await this.prisma.kbsCandidateProgress.count({
      where: { candidateId, passed: true, module: { courseId: activeCourseId } },
    });

    if (totalModules === 0 || completedModules < totalModules) return;

    const result = await this.prisma.kbsCandidate.updateMany({
      where: {
        id: candidateId,
        status: { in: [CandidateStatus.IN_TRAINING] },
      },
      data: { status: CandidateStatus.EXAM_PENDING },
    });

    if (result.count > 0) {
      this.logger.log(
        `Candidate ${candidateId} auto-transitioned to ${CandidateStatus.EXAM_PENDING}`,
      );
    }
  }

  private async requireVerifiedCandidateByUserIdOrThrow(userId: string) {
    const candidate = await this.findCandidateByUserIdOrThrow(userId);
    if (candidate.status === CandidateStatus.CANDIDATE) {
      throw new ForbiddenException(this.t('kbs.enrollment.awaitingVerification'));
    }
    return candidate;
  }

  private t(key: string, lang = 'fr', args?: Record<string, unknown>): string {
    return this.i18n.translate(key, { lang, args }) as string;
  }
}
