import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { EmailService, StorageService } from '@kambriq/common';
import { KbsCoursesService } from '../../kbs/courses/courses.service';
import { KbsCandidatesService } from '../../kbs/candidates/candidates.service';
import { KbsSettingsService } from '../../kbs/settings/settings.service';
import { KbsPrismaService } from '../../kbs/prisma/kbs-prisma.service';
import { CorePrismaService } from '../../core/prisma/core-prisma.service';
import { UsersService } from '../../core/users/users.service';
import { openKbsTestDatabase, type KbsTestDatabase } from './kbs-test-db';

/**
 * I38 - a candidate may only train inside the course they are enrolled in.
 *
 * I36 scoped the EXAM. The same hole stayed open on every other candidate-facing
 * path, and the KCA1 switch made it real rather than theoretical: KCA1 and the
 * demonstration course now coexist in the database, so a module id from the
 * course nobody is studying is a live id that the platform used to accept.
 *
 * Two of the holes WRITE. `submitQuiz` upserts `KbsCandidateProgress` and
 * `markLessonComplete` upserts `KbsLessonCompletion`, both keyed on ids the
 * caller supplies. A candidate passing a foreign module id therefore banked
 * progress against a course that is not their training - data damage, not a
 * display defect, which is why absence is asserted here and not just refusal.
 *
 * TWO COURSES COEXIST ON PURPOSE. Every existing quiz unit test mocks
 * `kbsModule.findUnique` returning a module with no course context at all, so
 * none of them could ever have caught this: the discriminating data was not in
 * the fixture. A single-course fixture is what let this live.
 *
 * **Provenance and absence, not counts.** "The count did not go up" passes for
 * the wrong reason when nothing was written for an unrelated cause - a thrown
 * validation error earlier in the method, say. So each assertion names the row
 * that must not exist, for that candidate, against that course.
 */
describe('I38 - a candidate cannot train outside their own course', () => {
  let db: KbsTestDatabase;
  let prisma: KbsPrismaService;
  let courses: KbsCoursesService;
  let candidates: KbsCandidatesService;

  const userId = randomUUID();

  let activeCourseId: string;
  let otherCourseId: string;
  let activeModuleId: string;
  let foreignModuleId: string;
  let foreignLessonId: string;
  let candidateId: string;

  beforeAll(async () => {
    db = openKbsTestDatabase();
    prisma = new KbsPrismaService({ get: () => db.url } as unknown as ConfigService);

    const moduleRef = await Test.createTestingModule({
      providers: [
        KbsCoursesService,
        KbsCandidatesService,
        KbsSettingsService,
        { provide: KbsPrismaService, useValue: prisma },
        { provide: CorePrismaService, useValue: {} },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: UsersService, useValue: { addRole: jest.fn() } },
        { provide: StorageService, useValue: {} },
        { provide: EmailService, useValue: { send: jest.fn() } },
      ],
    }).compile();
    courses = moduleRef.get(KbsCoursesService);
    candidates = moduleRef.get(KbsCandidatesService);

    await prisma.$executeRawUnsafe(
      `TRUNCATE "KbsExamAnswerSelection", "KbsExamAnswer", "KbsExam", "KbsExamQuestionAnswer",
                "KbsExamQuestion", "KbsAnswer", "KbsQuestion", "KbsLessonCompletion",
                "KbsCandidateProgress", "KbsLesson", "KbsModule", "KbsCourse", "KbsCandidate",
                "KbsSettings" CASCADE`,
    );

    /** A course with one module, its lessons, and a quiz pool deep enough to serve. */
    const makeCourse = async (title: string, tag: string) => {
      const course = await prisma.kbsCourse.create({
        data: { title: `${title} ${randomUUID()}`, description: title, isPublished: true },
      });
      const mod = await prisma.kbsModule.create({
        data: { courseId: course.id, title: `${tag} module`, description: tag, order: 1 },
      });
      const lesson = await prisma.kbsLesson.create({
        data: {
          moduleId: mod.id,
          title: `${tag} lesson`,
          contentType: 'HTML',
          content: `<p>${tag}</p>`,
          duration: 10,
          order: 1,
        },
      });
      for (let n = 0; n < 12; n++) {
        await prisma.kbsQuestion.create({
          data: {
            moduleId: mod.id,
            text: `${tag} question ${n}`,
            type: 'SINGLE',
            answers: {
              create: [
                { text: 'right', isCorrect: true },
                { text: 'wrong', isCorrect: false },
              ],
            },
          },
        });
      }
      return { courseId: course.id, moduleId: mod.id, lessonId: lesson.id };
    };

    const active = await makeCourse('KCA1 active', 'ACTIVE');
    const other = await makeCourse('Demonstration', 'OTHER');
    activeCourseId = active.courseId;
    otherCourseId = other.courseId;
    activeModuleId = active.moduleId;
    foreignModuleId = other.moduleId;
    foreignLessonId = other.lessonId;

    await prisma.kbsSettings.create({
      data: { activeCourseId, quizQuestionCount: 10, examQuestionCount: 20 },
    });

    const candidate = await prisma.kbsCandidate.create({
      data: { userId, status: 'IN_TRAINING' },
    });
    candidateId = candidate.id;
  }, 60_000);

  afterAll(async () => {
    await prisma?.onModuleDestroy();
    await db?.close();
  });

  /** Without two real courses the assertions below would prove nothing. */
  it('has two courses coexisting, with the candidate enrolled in one', async () => {
    const all = await prisma.kbsCourse.count();
    const settings = await prisma.kbsSettings.findFirst();

    expect(all).toBe(2);
    expect(settings?.activeCourseId).toBe(activeCourseId);
    expect(otherCourseId).not.toBe(activeCourseId);
  });

  it('serves the quiz of a module inside the active course', async () => {
    const quiz = await courses.findQuestionsForQuiz(activeModuleId, userId);

    expect(quiz.moduleId).toBe(activeModuleId);
    expect(quiz.questions).toHaveLength(10);
  });

  // ----- the perimeter, on each entry point -----

  it('refuses the quiz of a module in another course', async () => {
    await expect(courses.findQuestionsForQuiz(foreignModuleId, userId)).rejects.toThrow();
  });

  it('refuses a quiz submission against a module in another course', async () => {
    const foreign = await prisma.kbsQuestion.findMany({
      where: { moduleId: foreignModuleId },
      include: { answers: true },
      take: 10,
    });

    await expect(
      candidates.submitQuiz(userId, foreignModuleId, {
        answers: foreign.map((q) => ({
          questionId: q.id,
          answerIds: q.answers.filter((a) => a.isCorrect).map((a) => a.id),
        })),
      }),
    ).rejects.toThrow();
  });

  it('refuses to complete a lesson in another course', async () => {
    await expect(courses.markLessonComplete(userId, foreignLessonId)).rejects.toThrow();
  });

  it('refuses to open a module detail in another course', async () => {
    await expect(courses.findModuleDetail(foreignModuleId, userId)).rejects.toThrow();
  });

  it('refuses to open a lesson in another course', async () => {
    await expect(courses.findLessonById(foreignLessonId, userId)).rejects.toThrow();
  });

  // ----- absence, which is the assertion that matters -----

  /**
   * The harm was never the 200; it was the row. A refusal that still wrote
   * would be the same defect wearing an error code.
   */
  it('banked NO progress row against the other course', async () => {
    const rows = await prisma.kbsCandidateProgress.findMany({
      where: { candidateId, module: { courseId: otherCourseId } },
      select: { moduleId: true },
    });

    expect(rows).toEqual([]);
  });

  it('banked NO lesson completion against the other course', async () => {
    const rows = await prisma.kbsLessonCompletion.findMany({
      where: { candidateId, lesson: { module: { courseId: otherCourseId } } },
      select: { lessonId: true },
    });

    expect(rows).toEqual([]);
  });

  /**
   * And the candidate is not merely inert: the same calls against their own
   * course still write. Without this, refusing everything would pass the file.
   */
  it('still banks a completion inside the active course', async () => {
    const lesson = await prisma.kbsLesson.findFirstOrThrow({
      where: { module: { courseId: activeCourseId } },
    });

    await courses.markLessonComplete(userId, lesson.id);

    const rows = await prisma.kbsLessonCompletion.findMany({
      where: { candidateId, lesson: { module: { courseId: activeCourseId } } },
      select: { lessonId: true },
    });
    expect(rows.map((r) => r.lessonId)).toEqual([lesson.id]);
  });
});
