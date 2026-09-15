import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Test } from '@nestjs/testing';
import { EmailService, StorageService } from '@kambriq/common';
import { DEFAULT_QUIZ_QUESTION_COUNT } from '@kambriq/common/constants/kbs';
import { CorePrismaService } from '../../core/prisma/core-prisma.service';
import { UsersService } from '../../core/users/users.service';
import { KbsCandidatesService } from '../../kbs/candidates/candidates.service';
import { submitQuizSchema } from '../../kbs/candidates/dto/candidate.dto';
import { KbsCandidateController } from '../../kbs/controllers/kbs-candidate.controller';
import { KbsCoursesService } from '../../kbs/courses/courses.service';
import { KbsPrismaService } from '../../kbs/prisma/kbs-prisma.service';
import {
  buildCandidate,
  mockCorePrisma,
  mockEmailService,
  mockI18n,
  mockKbsPrisma,
  mockStorageService,
} from '../utils';

/**
 * I21 - the smaller defects around the exam: a quiz that counted a repeated
 * question, two screens that answered 500 when the settings row was missing,
 * and an outline that answered [] for a course that does not exist.
 */
describe('I21 - KBS robustness', () => {
  let prisma: ReturnType<typeof mockKbsPrisma>;
  let candidates: KbsCandidatesService;
  let courses: KbsCoursesService;

  beforeEach(async () => {
    prisma = mockKbsPrisma();
    const module = await Test.createTestingModule({
      providers: [
        KbsCandidatesService,
        KbsCoursesService,
        { provide: KbsPrismaService, useValue: prisma },
        { provide: CorePrismaService, useValue: mockCorePrisma() },
        { provide: I18nService, useValue: mockI18n() },
        { provide: UsersService, useValue: { addRole: jest.fn() } },
        { provide: StorageService, useValue: mockStorageService() },
        { provide: EmailService, useValue: mockEmailService() },
      ],
    }).compile();
    candidates = module.get(KbsCandidatesService);
    courses = module.get(KbsCoursesService);
  });

  it('the quiz schema refuses a repeated question id', () => {
    const q = '00000000-0000-4000-8000-000000000001';
    const a = '00000000-0000-4000-8000-000000000002';
    const parsed = submitQuizSchema.safeParse({
      answers: [
        { questionId: q, answerIds: [a] },
        { questionId: q, answerIds: [a] },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  describe('a missing settings row', () => {
    beforeEach(() => {
      prisma.kbsSettings.findFirst.mockResolvedValue(null);
    });

    it('the dashboard overview answers, with no active course, instead of a 500', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue({
        ...buildCandidate({ status: 'IN_TRAINING' }),
        progress: [],
        lessonCompletions: [],
      });

      const overview = await candidates.getMyOverview('u1');

      expect(overview.course).toBeNull();
    });

    it('the module screen answers with the defaults the quiz itself enforces', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(buildCandidate({ status: 'IN_TRAINING' }));
      prisma.kbsModule.findUnique.mockResolvedValue({
        id: 'm1',
        order: 1,
        title: 'M1',
        description: 'd',
        lessons: [],
      });
      prisma.kbsLessonCompletion.findMany.mockResolvedValue([]);
      prisma.kbsCandidateProgress.findUnique.mockResolvedValue(null);

      const detail = await courses.findModuleDetail('m1', 'u1');

      // 0 = unlimited, which is what `submitQuiz` enforces with no settings row.
      // The screen used to say 5 while the server allowed any number.
      expect(detail.quiz.maxAttempts).toBe(0);
      expect(detail.quiz.questionCount).toBe(DEFAULT_QUIZ_QUESTION_COUNT);
    });
  });

  describe('the course outline', () => {
    const controller = () =>
      new KbsCandidateController(
        courses,
        { findByUserId: jest.fn().mockResolvedValue(null) } as never,
        {} as never,
        {} as never,
      );

    it('answers 404 for a course that does not exist, not an empty list', async () => {
      prisma.kbsCourse.findUnique.mockResolvedValue(null);
      prisma.kbsModule.findMany.mockResolvedValue([]);

      await expect(controller().getCourseModules({ id: 'u1' } as never, 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('still lists the modules of a published course', async () => {
      prisma.kbsCourse.findUnique.mockResolvedValue({ id: 'c1', isPublished: true });
      prisma.kbsModule.findMany.mockResolvedValue([]);

      await expect(controller().getCourseModules({ id: 'u1' } as never, 'c1')).resolves.toEqual([]);
    });
  });
});
