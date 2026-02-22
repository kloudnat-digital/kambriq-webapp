import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from '@kambriq/common/services/storage.service';
import { KbsCoursesService } from '../../../kbs/courses/courses.service';
import { KbsPrismaService } from '../../../kbs/prisma/kbs-prisma.service';
import {
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

      await expect(service.findCourseById('bad-id')).rejects.toThrow(
        NotFoundException,
      );
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

      await expect(service.deleteCourse('nope')).rejects.toThrow(
        NotFoundException,
      );
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

      await expect(service.deleteModule('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reorderModules', () => {
    it('updates order for each module in a transaction', async () => {
      prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
        Promise.all(ops),
      );

      await service.reorderModules({
        courseId: 'c1',
        moduleIds: ['m1', 'm2', 'm3'],
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ----- Lessons ----- //

  describe('findLessonById', () => {
    it('returns lesson with a signed download URL', async () => {
      const lesson = buildLesson({
        module: { id: 'mod1', courseId: 'c1', title: 'Mod 1' },
      });
      prisma.kbsLesson.findUnique.mockResolvedValue(lesson);

      const result = await service.findLessonById(lesson.id);

      expect(storage.getDownloadUrl).toHaveBeenCalledWith(lesson.contentUrl);
      expect(result.contentUrl).toBe('https://s3.example.com/download');
    });

    it('throws NotFoundException for missing lesson', async () => {
      prisma.kbsLesson.findUnique.mockResolvedValue(null);

      await expect(service.findLessonById('bad')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ----- Questions ----- //

  describe('findQuestionsForQuiz', () => {
    it('returns shuffled questions without correct answers exposed', async () => {
      prisma.kbsSettings.findFirst.mockResolvedValue({ quizQuestionCount: 10 });
      const questions = Array.from({ length: 5 }, (_, i) =>
        buildQuestion({
          id: `q${i}`,
          answers: [
            { id: `a${i}_1`, text: 'Opt A' },
            { id: `a${i}_2`, text: 'Opt B' },
          ],
        }),
      );
      prisma.kbsQuestion.findMany.mockResolvedValue(questions);

      const result = await service.findQuestionsForQuiz('mod1');

      expect(result.length).toBeLessThanOrEqual(10);
      // Verify no isCorrect field is exposed
      for (const q of result) {
        for (const a of q.answers) {
          expect(a).not.toHaveProperty('isCorrect');
        }
      }
    });
  });

  describe('createQuestion', () => {
    it('creates a question with answers under a module', async () => {
      prisma.kbsModule.findUnique.mockResolvedValue(
        buildModule({ id: 'mod1' }),
      );
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
        fileName: 'lesson1.mp4',
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
