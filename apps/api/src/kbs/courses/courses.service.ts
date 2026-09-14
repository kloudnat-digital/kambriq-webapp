import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { KbsPrismaService } from '../prisma/kbs-prisma.service';
import {
  CreateCourseDto,
  CreateLessonDto,
  CreateModuleDto,
  CreateQuestionDto,
  GetCourseUploadUrlDto,
  ReorderModulesDto,
  UpdateCourseDto,
  UpdateLessonDto,
  UpdateModuleDto,
  UpdateQuestionDto,
} from './dto/course.dto';
import {
  CandidateStatus,
  DEFAULT_LANGUAGE,
  DEFAULT_QUIZ_QUESTION_COUNT,
  MODULE_PASSING_SCORE,
  StorageService,
} from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class KbsCoursesService {
  private readonly logger = new Logger(KbsCoursesService.name);

  constructor(
    private readonly prisma: KbsPrismaService,
    private readonly storage: StorageService,
    private readonly i18n: I18nService,
  ) {}

  // ----- Courses ---------------------------
  async findAllCourses() {
    return this.prisma.kbsCourse.findMany({
      include: {
        modules: {
          orderBy: { order: 'asc' },
          select: { id: true, title: true, order: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findCourseById(courseId: string) {
    const course = await this.prisma.kbsCourse.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: { orderBy: { order: 'asc' } },
            _count: { select: { questions: true } },
          },
        },
      },
    });

    if (!course)
      throw new NotFoundException(this.t('kbs.course.notFound', undefined, { id: courseId }));

    // A24. The admin course editor reads each module as AdminModule, which has
    // questionsCount (and lessonsCount). The raw Prisma module carries
    // _count.questions and a lessons array instead, so the editor rendered a
    // quiz count that was never there ("Q quiz"). Shape it to the type it is read as.
    return {
      ...course,
      modules: course.modules.map((module) => ({
        ...module,
        lessonsCount: module.lessons?.length ?? 0,
        questionsCount: module._count?.questions ?? 0,
      })),
    };
  }

  async createCourse(dto: CreateCourseDto) {
    const course = await this.prisma.kbsCourse.create({ data: dto });
    this.logger.log(`Course created %o`, {
      courseId: course.id,
      title: course.title,
    });
    return course;
  }

  async updateCourse(courseId: string, dto: UpdateCourseDto) {
    const course = await this.prisma.kbsCourse.update({
      where: { id: courseId },
      data: dto,
    });
    this.logger.log(`Course updated %o`, {
      courseId: course.id,
      title: course.title,
    });
    return course;
  }

  async deleteCourse(courseId: string) {
    const course = await this.prisma.kbsCourse.findUnique({
      where: { id: courseId },
      include: { _count: { select: { modules: true } } },
    });

    if (!course) {
      throw new NotFoundException(this.t('kbs.course.notFound', undefined, { id: courseId }));
    }

    await this.prisma.kbsCourse.delete({ where: { id: courseId } });
    this.logger.log(`Course deleted %o`, {
      courseId: course.id,
      title: course.title,
      modulesCount: course._count.modules,
    });
    return {
      message: this.t('kbs.course.deleted', undefined, { id: courseId }),
    };
  }

  // ----- Modules ---------------------------
  async findModulesByCourseId(courseId: string) {
    return this.prisma.kbsModule.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            contentType: true,
            order: true,
            duration: true,
          },
        },
        _count: { select: { questions: true, lessons: true } },
      },
    });
  }

  async findModuleDetail(moduleId: string, userId: string) {
    const candidate = await this.requireVerifiedCandidateByUserIdOrThrow(userId);

    const mod = await this.prisma.kbsModule.findUnique({
      where: { id: moduleId },
      include: {
        lessons: {
          orderBy: { order: 'desc' },
          select: {
            id: true,
            order: true,
            title: true,
            duration: true,
            contentType: true,
          },
        },
      },
    });

    if (!mod)
      throw new NotFoundException(
        this.t('kbs.module.notFound', DEFAULT_LANGUAGE, { id: moduleId }),
      );

    const settings = await this.prisma.kbsSettings.findFirst();
    const quizQuestionCount = settings.quizQuestionCount ?? 10;
    const quizMaxAttempts = settings.quizMaxAttempts ?? 5;
    const cooldownMinutes = settings.quizCooldownMinutes ?? 0;

    const [lessonCompletions, progress] = await Promise.all([
      this.prisma.kbsLessonCompletion.findMany({
        where: {
          candidateId: candidate.id,
          lessonId: { in: mod.lessons.map((l) => l.id) },
        },
        select: { lessonId: true, completedAt: true },
      }),
      this.prisma.kbsCandidateProgress.findUnique({
        where: {
          candidateId_moduleId: { candidateId: candidate.id, moduleId: mod.id },
        },
        select: { attempts: true, score: true, passed: true, updatedAt: true },
      }),
    ]);

    const completionByLessionId = new Map(
      lessonCompletions.map((c) => [c.lessonId, c.completedAt]),
    );
    const lessons = mod.lessons.map((l) => ({
      id: l.id,
      order: l.order,
      title: l.title,
      duration: l.duration,
      contentType: l.contentType,
      completedAt: completionByLessionId.get(l.id) ?? null,
    }));

    const allLessonsDone = lessons.length > 0 && lessons.every((l) => l.completedAt !== null);
    const attempts = progress?.attempts ?? 0;
    const passed = progress?.passed ?? false;
    const attemptsExhausted = quizMaxAttempts > 0 && attempts >= quizMaxAttempts;

    let nextAttemptAt: Date | null = null;
    if (progress?.updatedAt && cooldownMinutes > 0 && !passed && !attemptsExhausted) {
      const candidate = new Date(progress.updatedAt.getTime() + cooldownMinutes * 60 * 1000);
      if (candidate > new Date()) nextAttemptAt = candidate;
    }

    return {
      module: {
        id: mod.id,
        order: mod.order,
        title: mod.title,
        description: mod.description,
      },
      lessons,
      quiz: {
        unlocked: allLessonsDone && !nextAttemptAt && !attemptsExhausted,
        attempts,
        maxAttempts: quizMaxAttempts,
        cooldownMinutes,
        nextAttemptAt: nextAttemptAt?.toISOString() ?? null,
        score: progress?.score ?? null,
        passed,
        questionCount: quizQuestionCount,
      },
    };
  }

  async findModulesWithProgress(courseId: string, candidateId: string) {
    const modules = await this.prisma.kbsModule.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            contentType: true,
            order: true,
            duration: true,
          },
        },
        _count: { select: { questions: true, lessons: true } },
        progress: {
          where: { candidateId },
          select: { score: true, completedAt: true, passed: true },
        },
      },
    });

    return modules.map((module) => {
      const progress = module.progress[0] || null;
      return {
        id: module.id,
        title: module.title,
        description: module.description,
        order: module.order,
        lessonsCount: module._count.lessons,
        questionsCount: module._count?.questions ?? 0,
        lessons: module.lessons,
        progress: progress
          ? {
              score: progress.score,
              completedAt: progress.completedAt,
              passed: progress.passed,
            }
          : null,
      };
    });
  }

  async createModule(dto: CreateModuleDto) {
    const course = await this.prisma.kbsCourse.findUnique({
      where: { id: dto.courseId },
    });
    if (!course)
      throw new NotFoundException(this.t('kbs.course.notFound', 'en', { id: dto.courseId }));

    const mod = await this.prisma.kbsModule.create({ data: dto });
    this.logger.log(`Module created %o`, {
      moduleId: mod.id,
      title: mod.title,
      order: mod.order,
      courseId: mod.courseId,
    });
    return mod;
  }

  async updateModule(moduleId: string, dto: UpdateModuleDto) {
    const mod = await this.prisma.kbsModule.update({
      where: { id: moduleId },
      data: dto,
    });
    this.logger.log(`Module updated %o`, { moduleId: mod.id });
    return mod;
  }

  async reorderModules(dto: ReorderModulesDto) {
    return this.prisma.$transaction(
      dto.moduleIds.map((id, index) =>
        this.prisma.kbsModule.update({
          where: { id },
          data: { order: index + 1 },
        }),
      ),
    );
  }

  async deleteModule(moduleId: string) {
    const mod = await this.prisma.kbsModule.findUnique({
      where: { id: moduleId },
    });
    if (!mod) {
      throw new NotFoundException(this.t('kbs.module.notFound', undefined, { id: moduleId }));
    }
    await this.prisma.kbsModule.delete({ where: { id: moduleId } });
    this.logger.log(`Module deleted %o`, { moduleId, title: mod.title });
  }

  // ----- Lessons ---------------------------
  async findLessonById(id: string) {
    const lesson = await this.prisma.kbsLesson.findUnique({
      where: { id },
      include: {
        module: {
          select: {
            id: true,
            courseId: true,
            title: true,
          },
        },
      },
    });

    if (!lesson) throw new NotFoundException(this.t('kbs.lesson.notFound', undefined, { id }));

    const contentUrl =
      lesson.contentUrl && (lesson.contentType === 'VIDEO' || lesson.contentType === 'PDF')
        ? await this.storage.getDownloadUrl(lesson.contentUrl)
        : null;

    return { ...lesson, contentUrl };
  }

  async findLessonView(id: string, userId: string) {
    const candidate = await this.requireVerifiedCandidateByUserIdOrThrow(userId);

    const lesson = await this.prisma.kbsLesson.findUnique({
      where: { id },
      include: {
        module: {
          select: {
            id: true,
            order: true,
            title: true,
            lessons: {
              select: { id: true, order: true, title: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!lesson) throw new NotFoundException(this.t('kbs.lesson.notFound', undefined, { id }));

    const completion = await this.prisma.kbsLessonCompletion.findUnique({
      where: {
        candidateId_lessonId: { candidateId: candidate.id, lessonId: lesson.id },
      },
      select: { completedAt: true },
    });

    const siblings = lesson.module.lessons;
    const currentIndex = siblings.findIndex((l) => l.id === lesson.id);
    const prev = currentIndex > 0 ? siblings[currentIndex - 1] : null;
    const next = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;

    const signedContentUrl = (lesson.contentUrl =
      lesson.contentUrl && (lesson.contentType === 'VIDEO' || lesson.contentType === 'PDF')
        ? await this.storage.getDownloadUrl(lesson.contentUrl)
        : null);

    return {
      id: lesson.id,
      moduleId: lesson.module.id,
      moduleOrder: lesson.module.order,
      moduleTitle: lesson.module.title,
      order: lesson.order,
      title: lesson.title,
      contentType: lesson.contentType,
      duration: lesson.duration,
      contentUrl: signedContentUrl,
      content: lesson.content,
      completedAt: completion?.completedAt ?? null,
      navigation: {
        prev: prev ? { id: prev.id, order: prev.order, title: prev.title } : null,
        next: next ? { id: next.id, order: next.order, title: next.title } : null,
      },
    };
  }

  async createLesson(dto: CreateLessonDto) {
    const mod = await this.prisma.kbsModule.findUnique({
      where: { id: dto.moduleId },
    });
    if (!mod)
      throw new NotFoundException(this.t('kbs.module.notFound', undefined, { id: dto.moduleId }));

    const lesson = await this.prisma.kbsLesson.create({ data: dto });
    this.logger.log(`Lesson created %o`, {
      lessonId: lesson.id,
      title: lesson.title,
      order: lesson.order,
      moduleId: lesson.moduleId,
    });
    return lesson;
  }

  async updateLesson(id: string, dto: UpdateLessonDto) {
    const lesson = await this.prisma.kbsLesson.update({
      where: { id },
      data: dto,
    });
    this.logger.log(`Lesson updated %o`, { lessonId: lesson.id });
    return lesson;
  }

  async deleteLesson(id: string) {
    await this.prisma.kbsLesson.delete({ where: { id } });
    this.logger.log(`Lesson deleted %o`, { lessonId: id });
  }

  // ----- Questions + Answers ---------------------------
  async findQuestionsForQuiz(moduleId: string, userId: string) {
    const candidate = await this.requireVerifiedCandidateByUserIdOrThrow(userId);

    const [mod, settings] = await Promise.all([
      this.prisma.kbsModule.findUnique({
        where: { id: moduleId },
        select: { id: true, order: true, title: true },
      }),
      this.prisma.kbsSettings.findFirst(),
    ]);

    if (!mod) {
      throw new NotFoundException(this.t('kbs.module.notFound', undefined, { id: moduleId }));
    }

    const progress = await this.prisma.kbsCandidateProgress.findUnique({
      where: {
        candidateId_moduleId: { candidateId: candidate.id, moduleId },
      },
      select: { attempts: true },
    });

    const questionCount = settings?.quizQuestionCount ?? DEFAULT_QUIZ_QUESTION_COUNT;
    const raw = await this.prisma.kbsQuestion.findMany({
      where: { moduleId },
      include: {
        answers: {
          select: { id: true, text: true }, // No isCorrect!
        },
      },
    });
    // The draw is per module and sliced to questionCount. A module pool below
    // that length would silently serve a shorter quiz, the same defect as the
    // exam pool: no wrong number appears anywhere, the exercise just shrinks.
    if (raw.length < questionCount) {
      throw new ServiceUnavailableException(
        `${this.t('kbs.exam.noQuestions')} (module ${moduleId}: pool ${raw.length}, requis ${questionCount})`,
      );
    }

    const questions = this.shuffle(raw)
      .slice(0, questionCount)
      .map((q) => ({ ...q, answers: this.shuffle(q.answers) }));

    return {
      moduleId: mod.id,
      moduleOrder: mod.order,
      moduleTitle: mod.title,
      passingScore: MODULE_PASSING_SCORE,
      attempts: progress?.attempts ?? 0,
      maxAttempts: settings?.quizMaxAttempts ?? 0,
      questions,
    };
  }

  async findQuestionsAdmin(moduleId: string) {
    return this.prisma.kbsQuestion.findMany({
      where: { moduleId },
      include: { answers: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createQuestion(dto: CreateQuestionDto) {
    const mod = await this.prisma.kbsModule.findUnique({
      where: { id: dto.moduleId },
    });
    if (!mod)
      throw new NotFoundException(this.t('kbs.module.notFound', undefined, { id: dto.moduleId }));

    const question = await this.prisma.kbsQuestion.create({
      data: {
        moduleId: dto.moduleId as string,
        text: dto.text,
        type: (dto.type ?? 'SINGLE') as 'SINGLE' | 'MULTIPLE',
        ...(dto.answers && {
          answers: {
            create: dto.answers.map((a) => ({
              text: a.text,
              isCorrect: a.isCorrect,
            })),
          },
        }),
      },
      include: { answers: true },
    });

    this.logger.log(`Question created %o`, {
      questionId: question.id,
      moduleId: question.moduleId,
    });
    return question;
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto) {
    const existing = await this.prisma.kbsQuestion.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(this.t('kbs.question.notFound', undefined, { id }));

    if (dto.answers) {
      return this.prisma.$transaction(async (tx) => {
        await tx.kbsAnswer.deleteMany({ where: { questionId: id } });
        return tx.kbsQuestion.update({
          where: { id },
          data: {
            ...(dto.text !== undefined && { text: dto.text }),
            ...(dto.type !== undefined && { type: dto.type }),
            answers: {
              create: (dto.answers ?? []).map((a) => ({
                text: a.text,
                isCorrect: a.isCorrect,
              })),
            },
          },
          include: { answers: true },
        });
      });
    }

    return this.prisma.kbsQuestion.update({
      where: { id },
      data: {
        ...(dto.text !== undefined && { text: dto.text }),
        ...(dto.type !== undefined && { type: dto.type }),
      },
      include: { answers: true },
    });
  }

  async deleteQuestion(id: string) {
    await this.prisma.kbsQuestion.delete({ where: { id } });
    this.logger.log(`Question deleted %o`, { questionId: id });
  }

  // ----- Utils ---------------------------

  async getUploadUrl(dto: GetCourseUploadUrlDto) {
    const key = this.storage.buildKey(
      'kbs',
      'content',
      dto.moduleId || 'general',
      dto.lessonId || 'uploads',
      `${Date.now()}-${dto.filename}`,
    );
    return this.storage.getUploadUrl(key, dto.contentType);
  }

  // ----- Lesson Completion Tracking ---------------------------

  /**
   * Records that a candidate has completed (viewed/finished) a lesson.
   * Idempotent - calling it twice for the same lesson is safe.
   */
  async markLessonComplete(userId: string, lessonId: string) {
    const candidate = await this.requireVerifiedCandidateByUserIdOrThrow(userId);

    const lesson = await this.prisma.kbsLesson.findUnique({
      where: { id: lessonId },
      select: { id: true, moduleId: true },
    });
    if (!lesson) {
      throw new NotFoundException(this.t('kbs.lesson.notFound', undefined, { id: lessonId }));
    }

    await this.prisma.kbsLessonCompletion.upsert({
      where: { candidateId_lessonId: { candidateId: candidate.id, lessonId } },
      create: { candidateId: candidate.id, lessonId },
      update: {}, // Already completed - no update needed
    });

    // Return count of completed lessons in the module so the client can show progress
    const moduleTotal = await this.prisma.kbsLesson.count({
      where: { moduleId: lesson.moduleId },
    });
    const moduleCompleted = await this.prisma.kbsLessonCompletion.count({
      where: {
        candidateId: candidate.id,
        lesson: { moduleId: lesson.moduleId },
      },
    });

    return {
      lessonId,
      moduleId: lesson.moduleId,
      moduleLessonsCompleted: moduleCompleted,
      moduleLessonsTotal: moduleTotal,
      moduleFullyViewed: moduleCompleted >= moduleTotal,
    };
  }

  async getLessonCompletions(candidateId: string, moduleId: string) {
    const completions = await this.prisma.kbsLessonCompletion.findMany({
      where: { candidateId, lesson: { moduleId } },
      select: { lessonId: true, completedAt: true },
    });
    return completions;
  }

  private async requireVerifiedCandidateByUserIdOrThrow(userId: string) {
    const candidate = await this.prisma.kbsCandidate.findUnique({ where: { userId } });
    if (!candidate) {
      throw new NotFoundException(this.t('kbs.enrollment.notEnrolled'));
    }
    if (candidate.status === CandidateStatus.CANDIDATE) {
      throw new ForbiddenException(this.t('kbs.enrollment.awaitingVerification'));
    }
    return candidate;
  }

  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private t(key: string, lang = 'en', args?: Record<string, unknown>): string {
    return this.i18n.translate(key, { lang, args }) as string;
  }
}
