import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KbsPrismaService } from '../prisma/kbs-prisma.service';
import {
  CreateCourseDto,
  CreateLessonDto,
  CreateModuleDto,
  CreateQuestionDto,
  GetUploadUrlDto,
  ReorderModulesDto,
  UpdateCourseDto,
  UpdateLessonDto,
  UpdateModuleDto,
  UpdateQuestionDto,
} from './course.dto.ts/course.dto';
import { DEFAULT_QUIZ_QUESTION_COUNT, StorageService } from '@kambriq/common';
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
      throw new NotFoundException(
        this.t('kbs.course.notFound', undefined, { id: courseId }),
      );
    return course;
  }

  async createCourse(dto: CreateCourseDto) {
    const course = await this.prisma.kbsCourse.create({ data: dto });
    this.logger.log(`Course created`, {
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
    this.logger.log(`Course updated`, {
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
      throw new NotFoundException(
        this.t('kbs.course.notFound', undefined, { id: courseId }),
      );
    }

    await this.prisma.kbsCourse.delete({ where: { id: courseId } });
    this.logger.log(`Course deleted`, {
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
        questionsCount: module._count.questions,
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
      throw new NotFoundException(
        this.t('kbs.course.notFound', 'en', { id: dto.courseId }),
      );

    const mod = await this.prisma.kbsModule.create({ data: dto });
    this.logger.log(`Module created`, {
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
    this.logger.log(`Module updated`, { moduleId: mod.id });
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
      throw new NotFoundException(
        this.t('kbs.module.notFound', undefined, { id: moduleId }),
      );
    }
    await this.prisma.kbsModule.delete({ where: { id: moduleId } });
    this.logger.log(`Module deleted`, { moduleId, title: mod.title });
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

    if (!lesson)
      throw new NotFoundException(
        this.t('kbs.lesson.notFound', undefined, { id }),
      );

    // Generate download URL from S3
    const contentUrl = await this.storage.getDownloadUrl(lesson.contentUrl);

    return { ...lesson, contentUrl };
  }

  async createLesson(dto: CreateLessonDto) {
    const mod = await this.prisma.kbsModule.findUnique({
      where: { id: dto.moduleId },
    });
    if (!mod)
      throw new NotFoundException(
        this.t('kbs.module.notFound', undefined, { id: dto.moduleId }),
      );

    const lesson = await this.prisma.kbsLesson.create({ data: dto });
    this.logger.log(`Lesson created`, {
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
    this.logger.log(`Lesson updated`, { lessonId: lesson.id });
    return lesson;
  }

  async deleteLesson(id: string) {
    await this.prisma.kbsLesson.delete({ where: { id } });
    this.logger.log(`Lesson deleted`, { lessonId: id });
  }

  // ----- Questions + Answers ---------------------------
  async findQuestionsForQuiz(moduleId: string) {
    const settings = await this.prisma.kbsSettings.findFirst();
    const questionCount = settings?.quizQuestionCount ?? DEFAULT_QUIZ_QUESTION_COUNT;

    const questions = await this.prisma.kbsQuestion.findMany({
      where: { moduleId },
      include: {
        answers: {
          select: { id: true, text: true }, // No isCorrect!
        },
      },
    });

    return this.shuffle(questions)
      .slice(0, questionCount)
      .map((q) => ({ ...q, answers: this.shuffle(q.answers) }));
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
      throw new NotFoundException(
        this.t('kbs.module.notFound', undefined, { id: dto.moduleId }),
      );

    const question = await this.prisma.kbsQuestion.create({
      data: {
        moduleId: dto.moduleId,
        text: dto.text,
        type: dto.type,
        answers: {
          create: dto.answers.map((a) => ({
            text: a.text,
            isCorrect: a.isCorrect,
          })),
        },
      },
      include: { answers: true },
    });

    this.logger.log(`Question created`, {
      questionId: question.id,
      moduleId: question.moduleId,
    });
    return question;
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto) {
    const existing = await this.prisma.kbsQuestion.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException(
        this.t('kbs.question.notFound', undefined, { id }),
      );

    if (dto.answers) {
      return this.prisma.$transaction(async (tx) => {
        await tx.kbsAnswer.deleteMany({ where: { questionId: id } });
        return tx.kbsQuestion.update({
          where: { id },
          data: {
            ...(dto.text !== undefined && { text: dto.text }),
            ...(dto.type !== undefined && { type: dto.type }),
            answers: {
              create: dto.answers.map((a) => ({
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
    this.logger.log(`Question deleted`, { questionId: id });
  }

  // ----- Utils ---------------------------

  async getUploadUrl(dto: GetUploadUrlDto) {
    const key = this.storage.buildKey(
      'kbs',
      'content',
      dto.moduleId || 'general',
      dto.lessonId || 'uploads',
      `${Date.now()}-${dto.fileName}`,
    );
    return this.storage.getUploadUrl(key, dto.contentType);
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
