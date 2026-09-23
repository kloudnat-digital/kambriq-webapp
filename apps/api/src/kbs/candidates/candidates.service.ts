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
import { NEWEST_FIRST } from '../certificates/current-certificate';
import {
  CvUploadUrlDto,
  EnrollDto,
  SubmitQuizDto,
  UpdateCandidateStatusDto,
} from './dto/candidate.dto';
import {
  ageInDays,
  buildPaginatedResponse,
  CandidateStatus,
  DEFAULT_LANGUAGE,
  EmailService,
  withOldestWaiting,
  DEFAULT_QUIZ_QUESTION_COUNT,
  MODULE_PASSING_SCORE,
  PaginationQuery,
  RoleCode,
  STATUS_TRANSITIONS,
  StorageService,
} from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';
import { CorePrismaService } from '../../core/prisma/core-prisma.service';
import { assertInActiveCourse, readActiveCourse } from '../settings/active-course';

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
  /**
   * The candidate's profile, counted against the active course only.
   *
   * Several courses coexist, so the denominator, the numerator and the module
   * list must all filter on `activeCourseId`. They are derived from one value
   * here because scoping only the denominator is worse than scoping neither:
   * the numerator would still count modules passed in another course, and the
   * ratio would report a finished course to a candidate who is halfway.
   *
   * With no active course configured (I38) the profile returns the candidate's
   * identity and certificate with zero progress, matching `getMyOverview`.
   */
  async getMyProfile(userId: string) {
    const [candidate, settings] = await Promise.all([
      this.prisma.kbsCandidate.findUnique({
        where: { userId },
        include: {
          progress: {
            include: {
              // `courseId` is what the scoping below reads. Without it the
              // filter has nothing to compare and this is an unscoped list.
              module: { select: { id: true, title: true, order: true, courseId: true } },
            },
            orderBy: { module: { order: 'asc' } },
          },
          certificates: {
            ...NEWEST_FIRST,
            take: 1,
            select: { kcaNumber: true, issueDate: true, validUntil: true },
          },
        },
      }),
      readActiveCourse(this.prisma),
    ]);

    if (!candidate) {
      throw new NotFoundException(this.t('kbs.enrollment.notEnrolled'));
    }

    const activeCourseId = settings?.activeCourseId ?? null;

    // The single filter the numerator and the module list are both built from,
    // so the two cannot drift apart into a half fix.
    const courseProgress = activeCourseId
      ? candidate.progress.filter((p) => p.module.courseId === activeCourseId)
      : [];

    const totalModules = activeCourseId
      ? await this.prisma.kbsModule.count({ where: { courseId: activeCourseId } })
      : 0;
    const completedModules = courseProgress.filter((p) => p.passed).length;
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
      modules: courseProgress.map((p) => ({
        moduleId: p.moduleId,
        moduleTitle: p.module.title,
        moduleOrder: p.module.order,
        score: p.score,
        passed: p.passed,
        completedAt: p.completedAt,
      })),
      certificate: candidate.certificates[0] ?? null,
    };
  }

  // ----- Candidate Progress Overview --------------------

  async getMyOverview(userId: string) {
    const candidate = await this.prisma.kbsCandidate.findUnique({
      where: { userId },
      include: {
        progress: true,
        lessonCompletions: { select: { lessonId: true } },
        certificates: { ...NEWEST_FIRST, take: 1, select: { kcaNumber: true } },
      },
    });

    if (!candidate) {
      throw new NotFoundException(this.t('kbs.enrollment.notEnrolled'));
    }
    if (candidate.status === CandidateStatus.CANDIDATE) {
      throw new ForbiddenException(this.t('kbs.enrollment.awaitingVerification'));
    }

    // I21 - no settings row is "no active course", not a 500. I38 - read
    // through the one reader; the empty-overview branch below IS this call
    // site's absence behaviour, stated rather than inherited.
    const settings = await readActiveCourse(this.prisma);
    const activeCourseId = settings?.activeCourseId ?? null;

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

    // I21 - one question answered ten times is not ten answers. The schema
    // refuses repeats too; this covers any caller that skips the DTO.
    const questionIds = dto.answers.map((a) => a.questionId);
    if (new Set(questionIds).size !== questionIds.length) {
      throw new BadRequestException(this.t('kbs.quiz.duplicateQuestion'));
    }

    // Validate module exists
    const mod = await this.prisma.kbsModule.findUnique({
      where: { id: moduleId },
      include: { course: { select: { id: true } } },
    });
    if (!mod)
      throw new NotFoundException(this.t('kbs.module.notFound', undefined, { id: moduleId }));

    // I38 - a WRITER, so `refuse`. This upserts KbsCandidateProgress keyed on a
    // moduleId the caller supplies, so before the guard a candidate could pass
    // a demonstration module id and bank a passed row against a course that is
    // not their training. The prerequisite check below is a DIFFERENT question
    // and is not made redundant by this one: it asks whether the earlier
    // modules of this course were passed, which still matters once the course
    // is known to be the right one.
    const activeSettings = await readActiveCourse(this.prisma);
    assertInActiveCourse(
      mod.course.id,
      activeSettings?.activeCourseId,
      () => new NotFoundException(this.t('kbs.module.notFound', undefined, { id: moduleId })),
    );

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
    // I38 - the row was already read for the guard above; reading it twice was
    // both a second query and the last inline read this subject exists to end.
    const settings = activeSettings;
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
          certificates: { ...NEWEST_FIRST, take: 1, select: { kcaNumber: true } },
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
        kcaNumber: c.certificates[0]?.kcaNumber || null,
      };
    });

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * The activation queue: who is waiting to be let in, and how long they have waited.
   *
   * I39. The act of activation was never missing - `updateStatus` has a full
   * state machine, `adminUpdateCandidateStatus` calls it, and the candidate
   * detail screen puts it under a button. What was missing is any reason for an
   * administrator to go and look: `/admin/kbs` is a redirect, and nothing
   * anywhere counted the people stuck at CANDIDATE or said how long they had
   * been stuck.
   *
   * That is A10 returning in another module - a reviewer route and a reviewer
   * role that both existed while the queue did not, so nothing had ever been
   * reviewed. **A count answers "how many"; it does not answer "how long has
   * somebody been waiting", which is the question a backlog exists to answer.**
   *
   * Aged on `enrolledAt`, which the model already carries: unlike A10, no column
   * had to be added to make the wait measurable.
   */
  async listPendingCandidates(query: PaginationQuery) {
    const { page, limit } = query;
    const where = { status: CandidateStatus.CANDIDATE };

    const [candidates, total, oldest] = await this.prisma.$transaction([
      this.prisma.kbsCandidate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        // Oldest first, deliberately: newest-first hides the person who has been
        // waiting longest, and they are the only row that really matters.
        orderBy: { enrolledAt: 'asc' },
      }),
      this.prisma.kbsCandidate.count({ where }),
      this.prisma.kbsCandidate.findFirst({
        where,
        orderBy: { enrolledAt: 'asc' },
        select: { enrolledAt: true },
      }),
    ]);

    // Names and addresses live in core. A queue of opaque ids is a list nobody
    // can act on, which is most of what was wrong with not having one.
    const users = await this.userService.findManyByIds(
      candidates.map((c: { userId: string }) => c.userId),
    );
    const userById = new Map(users.map((u) => [u.id, u]));
    const now = Date.now();

    const response = buildPaginatedResponse(
      candidates.map(
        (c: { id: string; userId: string; sponsorCode: string | null; enrolledAt: Date }) => {
          const u = userById.get(c.userId);
          return {
            id: c.id,
            userId: c.userId,
            firstName: u?.firstName ?? null,
            lastName: u?.lastName ?? null,
            email: u?.email ?? null,
            sponsorCode: c.sponsorCode,
            enrolledAt: c.enrolledAt,
            waitingDays: ageInDays(c.enrolledAt, now),
          };
        },
      ),
      total,
      page,
      limit,
    );

    return withOldestWaiting(response, oldest?.enrolledAt ?? null, now);
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
        certificates: { ...NEWEST_FIRST, take: 1 },
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

    // I15 renewal: the admin screen shows the current certificate, as before.
    const { certificates, ...rest } = candidate;

    return {
      ...rest,
      certificate: certificates[0] ?? null,
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
        // I15 renewal: the current certificate is the newest one.
        certificates: {
          ...NEWEST_FIRST,
          take: 1,
          select: { kcaNumber: true, validUntil: true, revokedAt: true },
        },
      },
    });

    if (candidate?.status !== CandidateStatus.CERTIFIED) return null;

    const certificate = candidate.certificates[0];
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
    // I38 - one reader. The log-and-return below is this call site's absence
    // behaviour, and it stays: the candidate is stranded and somebody has to
    // be told.
    const settings = await readActiveCourse(this.prisma);
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
