import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from '@kambriq/common/services/storage.service';
import { KbsCoursesService } from '../../../kbs/courses/courses.service';
import { KbsCandidateController } from '../../../kbs/controllers/kbs-candidate.controller';
import { KbsPrismaService } from '../../../kbs/prisma/kbs-prisma.service';
import {
  buildCandidate,
  buildCourse,
  buildLesson,
  buildModule,
  buildQuestion,
  mockI18n,
  mockKbsPrisma,
  mockStorageService,
  resetIdCounter,
} from '../../utils';

describe('KbsCoursesService', () => {
  let service: KbsCoursesService;
  let prisma: ReturnType<typeof mockKbsPrisma>;
  let storage: ReturnType<typeof mockStorageService>;

  beforeEach(async () => {
    resetIdCounter();
    prisma = mockKbsPrisma();
    storage = mockStorageService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbsCoursesService,
        { provide: KbsPrismaService, useValue: prisma },
        { provide: I18nService, useValue: mockI18n() },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get(KbsCoursesService);
  });

  // ----- Courses ----- //

  describe('findAllCourses', () => {
    it('returns all courses with modules', async () => {
      const courses = [buildCourse(), buildCourse({ title: 'Advanced' })];
      prisma.kbsCourse.findMany.mockResolvedValue(courses);

      const result = await service.findAllCourses();
      expect(result).toHaveLength(2);
    });
  });

  describe('findCourseById', () => {
    it('returns course with nested modules and lessons', async () => {
      const course = buildCourse({ modules: [buildModule()] });
      prisma.kbsCourse.findUnique.mockResolvedValue(course);

      const result = await service.findCourseById(course.id);
      expect(result.id).toBe(course.id);
    });

    it('throws NotFoundException for missing course', async () => {
      prisma.kbsCourse.findUnique.mockResolvedValue(null);

      await expect(service.findCourseById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCourse', () => {
    it('creates and returns the course', async () => {
      const dto = {
        title: 'New Course',
        description: 'Desc',
        duration: 60,
        isPublished: false,
      };
      const created = buildCourse(dto);
      prisma.kbsCourse.create.mockResolvedValue(created);

      const result = await service.createCourse(dto);
      expect(result.title).toBe('New Course');
      expect(prisma.kbsCourse.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('deleteCourse', () => {
    it('deletes and returns success message', async () => {
      const course = buildCourse({ _count: { modules: 2 } });
      prisma.kbsCourse.findUnique.mockResolvedValue(course);
      prisma.kbsCourse.delete.mockResolvedValue(course);

      const result = await service.deleteCourse(course.id);
      expect(result).toHaveProperty('message');
    });

    it('throws NotFoundException if course does not exist', async () => {
      prisma.kbsCourse.findUnique.mockResolvedValue(null);

      await expect(service.deleteCourse('nope')).rejects.toThrow(NotFoundException);
    });
  });

  // ----- Modules ----- //

  describe('createModule', () => {
    it('creates a module under an existing course', async () => {
      prisma.kbsCourse.findUnique.mockResolvedValue(buildCourse({ id: 'c1' }));
      const mod = buildModule({ courseId: 'c1' });
      prisma.kbsModule.create.mockResolvedValue(mod);

      const result = await service.createModule({
        courseId: 'c1',
        title: 'Module 1',
        description: 'Desc',
        order: 1,
      });

      expect(result.courseId).toBe('c1');
    });

    it('throws if parent course does not exist', async () => {
      prisma.kbsCourse.findUnique.mockResolvedValue(null);

      await expect(
        service.createModule({
          courseId: 'bad',
          title: 'Module 1',
          description: 'Desc',
          order: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteModule', () => {
    it('throws NotFoundException if module is missing', async () => {
      prisma.kbsModule.findUnique.mockResolvedValue(null);

      await expect(service.deleteModule('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorderModules', () => {
    it('updates order for each module in a transaction', async () => {
      prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));

      await service.reorderModules({
        courseId: 'c1',
        moduleIds: ['m1', 'm2', 'm3'],
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ----- Lessons ----- //

  /**
   * I20 - a lesson is served only to someone whose enrolment permits it.
   *
   * `GET /kbs/lesson/:lessonId` served any lesson - its inline content and a
   * signed download URL - to any logged-in account: no candidate record, no
   * status, no published course. Registration is open, so that was anybody with
   * an e-mail address reading the training KBS sells. The rule the rest of the
   * candidate routes already apply is the KbsCandidate record past verification;
   * it is applied here too, plus a published course.
   */
  describe('findLessonById', () => {
    const read = (id: string, userId: string) => service.findLessonById(id, userId);
    const lessonOf = (isPublished: boolean) =>
      buildLesson({
        module: { id: 'mod1', courseId: 'c1', title: 'Mod 1', course: { isPublished } },
      });

    it('serves a verified candidate a lesson of a published course, with a signed URL', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(buildCandidate({ status: 'IN_TRAINING' }));
      const lesson = lessonOf(true);
      prisma.kbsLesson.findUnique.mockResolvedValue(lesson);

      const result = await read(lesson.id, 'u1');

      expect(storage.getDownloadUrl).toHaveBeenCalledWith(lesson.contentUrl);
      expect(result.contentUrl).toBe('https://s3.example.com/download');
    });

    it('refuses an account with no candidate record, and signs nothing', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(null);
      prisma.kbsLesson.findUnique.mockResolvedValue(lessonOf(true));

      await expect(read('l1', 'u-stranger')).rejects.toThrow(NotFoundException);
      expect(storage.getDownloadUrl).not.toHaveBeenCalled();
    });

    it('refuses a candidate still awaiting verification', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(buildCandidate({ status: 'CANDIDATE' }));
      prisma.kbsLesson.findUnique.mockResolvedValue(lessonOf(true));

      await expect(read('l1', 'u1')).rejects.toThrow(ForbiddenException);
      expect(storage.getDownloadUrl).not.toHaveBeenCalled();
    });

    it('refuses a lesson of an unpublished course, even to a verified candidate', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(buildCandidate({ status: 'IN_TRAINING' }));
      prisma.kbsLesson.findUnique.mockResolvedValue(lessonOf(false));

      await expect(read('l1', 'u1')).rejects.toThrow(NotFoundException);
      expect(storage.getDownloadUrl).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for missing lesson', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(buildCandidate({ status: 'IN_TRAINING' }));
      prisma.kbsLesson.findUnique.mockResolvedValue(null);

      await expect(read('bad', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  /**
   * I20 - an unpublished course's outline is not shown on the candidate side.
   * Admins read every course through `/kbs/admin/courses`.
   */
  describe('module outline', () => {
    it('lists modules of a published course only', async () => {
      prisma.kbsModule.findMany.mockResolvedValue([]);

      await service.findModulesByCourseId('c1');

      expect(prisma.kbsModule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { courseId: 'c1', course: { isPublished: true } } }),
      );
    });

    it('does the same when the caller is a candidate with progress', async () => {
      prisma.kbsModule.findMany.mockResolvedValue([]);

      await service.findModulesWithProgress('c1', 'cand-1');

      expect(prisma.kbsModule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { courseId: 'c1', course: { isPublished: true } } }),
      );
    });
  });

  /**
   * I20 - `GET /kbs/courses` said "published courses" and returned every course.
   * The candidate-facing list shows published ones; the admin list keeps all.
   */
  describe('course listing', () => {
    it('the candidate-facing list asks for published courses only', async () => {
      prisma.kbsCourse.findMany.mockResolvedValue([]);
      const controller = new KbsCandidateController(service, {} as never, {} as never, {} as never);

      await controller.listCourses();

      expect(prisma.kbsCourse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isPublished: true } }),
      );
    });
  });

  // ----- Questions ----- //

  describe('findQuestionsForQuiz', () => {
    it('refuses when the module pool is below quizQuestionCount', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(buildCandidate({ status: 'IN_TRAINING' }));
      prisma.kbsModule.findUnique.mockResolvedValue(
        buildModule({ id: 'mod1', order: 1, title: 'Module 1' }),
      );
      prisma.kbsSettings.findFirst.mockResolvedValue({ quizQuestionCount: 10 });
      prisma.kbsCandidateProgress.findUnique.mockResolvedValue({ attempts: 0 });
      prisma.kbsQuestion.findMany.mockResolvedValue(
        Array.from({ length: 9 }, (_, i) => buildQuestion({ id: `q${i}`, answers: [] })),
      );

      // Serving 9 questions as a 10-question quiz is the silent shortfall this
      // guard exists to prevent. The message must name both numbers.
      await expect(service.findQuestionsForQuiz('mod1', 'u1')).rejects.toThrow(/pool 9, requis 10/);
    });

    it('returns shuffled questions without correct answers exposed', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(buildCandidate({ status: 'IN_TRAINING' }));
      prisma.kbsModule.findUnique.mockResolvedValue(
        buildModule({ id: 'mod1', order: 1, title: 'Module 1' }),
      );
      prisma.kbsSettings.findFirst.mockResolvedValue({ quizQuestionCount: 10 });
      prisma.kbsCandidateProgress.findUnique.mockResolvedValue({ attempts: 0 });
      const questions = Array.from({ length: 30 }, (_, i) =>
        buildQuestion({
          id: `q${i}`,
          answers: [
            { id: `a${i}_1`, text: 'Opt A' },
            { id: `a${i}_2`, text: 'Opt B' },
          ],
        }),
      );
      prisma.kbsQuestion.findMany.mockResolvedValue(questions);

      const result = await service.findQuestionsForQuiz('mod1', 'u1');

      // EXACTLY quizQuestionCount, not "at most". The previous assertion was
      // toBeLessThanOrEqual(10) against a fixture of 5, so it passed while the
      // service served a five-question quiz: a short pool was silently accepted
      // by the very test meant to cover it.
      expect(result.questions.length).toBe(10);
      // Verify no isCorrect field is exposed
      for (const q of result.questions) {
        for (const a of q.answers) {
          expect(a).not.toHaveProperty('isCorrect');
        }
      }
    });
  });

  describe('createQuestion', () => {
    it('creates a question with answers under a module', async () => {
      prisma.kbsModule.findUnique.mockResolvedValue(buildModule({ id: 'mod1' }));
      const question = buildQuestion();
      prisma.kbsQuestion.create.mockResolvedValue(question);

      const result = await service.createQuestion({
        moduleId: 'mod1',
        text: 'What is TFL?',
        type: 'SINGLE',
        answers: [
          { text: 'Titled Freehold Land', isCorrect: true },
          { text: 'Total Flat Lease', isCorrect: false },
        ],
      });

      expect(result).toBeDefined();
      expect(prisma.kbsQuestion.create).toHaveBeenCalled();
    });
  });

  // ----- Upload URL ----- //

  describe('getUploadUrl', () => {
    it('generates S3 upload URL with correct key structure', async () => {
      const result = await service.getUploadUrl({
        filename: 'lesson1.mp4',
        contentType: 'video/mp4',
        moduleId: 'mod1',
        lessonId: 'les1',
      });

      expect(storage.buildKey).toHaveBeenCalledWith(
        'kbs',
        'content',
        'mod1',
        'les1',
        expect.stringContaining('lesson1.mp4'),
      );
      expect(result).toHaveProperty('uploadUrl');
    });
  });
});
