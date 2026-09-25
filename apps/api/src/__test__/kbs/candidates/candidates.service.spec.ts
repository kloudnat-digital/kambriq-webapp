import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Test, TestingModule } from '@nestjs/testing';
import { EmailService, StorageService } from '@kambriq/common';
import { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import { UsersService } from '../../../core/users/users.service';
import { KbsCandidatesService } from '../../../kbs/candidates/candidates.service';
import { KbsPrismaService } from '../../../kbs/prisma/kbs-prisma.service';
import {
  buildCandidate,
  buildModule,
  mockCorePrisma,
  mockEmailService,
  mockI18n,
  mockKbsPrisma,
  mockStorageService,
  resetIdCounter,
} from '../../utils';

describe('KbsCandidatesService', () => {
  let service: KbsCandidatesService;
  let prisma: ReturnType<typeof mockKbsPrisma>;
  let corePrisma: ReturnType<typeof mockCorePrisma>;
  let usersService: { addRole: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    resetIdCounter();
    prisma = mockKbsPrisma();
    corePrisma = mockCorePrisma();
    usersService = { addRole: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbsCandidatesService,
        { provide: KbsPrismaService, useValue: prisma },
        { provide: CorePrismaService, useValue: corePrisma },
        { provide: I18nService, useValue: mockI18n() },
        { provide: UsersService, useValue: usersService },
        { provide: StorageService, useValue: mockStorageService() },
        { provide: EmailService, useValue: mockEmailService() },
      ],
    }).compile();

    service = module.get(KbsCandidatesService);
  });

  // ----- ENROLL ----- //

  describe('enroll', () => {
    it('creates a candidate and assigns CANDIDATE_KBS role', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(null);
      corePrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@test.com',
        firstName: 'Alice',
        preferredLanguage: 'fr',
        profile: { idDocumentUrls: ['s3://key'] },
      });
      const candidate = buildCandidate({ userId: 'u1' });
      prisma.kbsCandidate.create.mockResolvedValue(candidate);

      const result = await service.enroll('u1', {
        sponsorCode: 'SP001',
        engagementAccepted: true,
      });

      expect(prisma.kbsCandidate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u1',
            sponsorCode: 'SP001',
            status: 'CANDIDATE',
          }),
        }),
      );
      expect(usersService.addRole).toHaveBeenCalledWith('u1', 'CANDIDATE_KBS');
      expect(result).toEqual(candidate);
    });

    it('throws ConflictException if already enrolled', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(buildCandidate());

      await expect(service.enroll('u1', { engagementAccepted: true })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.kbsCandidate.create).not.toHaveBeenCalled();
    });
  });

  // ----- GET MY PROFILE ----- //

  describe('getMyProfile', () => {
    /**
     * Two courses in the fixture, because one cannot discriminate.
     *
     * The mock answers the `where` it is handed. A mock returning a fixed
     * count makes the scoped and unscoped calls indistinguishable, so neither
     * side of the ratio can be observed.
     *
     * The database-backed proof is in `progress-counts-course-scope.dbspec.ts`;
     * these pin the shape on pull requests, where no database runs.
     */
    const ACTIVE = 'course-active';
    const OTHER = 'course-other';

    /** Answers the filter given: 3 modules in the active course, 5 across both. */
    const countByCourse = ({ where }: { where?: { courseId?: string } } = {}) =>
      Promise.resolve(where?.courseId === ACTIVE ? 3 : 5);

    /** One pass and one failure in the active course, one pass in the other. */
    const twoCourseCandidate = () =>
      buildCandidate({
        progress: [
          {
            moduleId: 'm1',
            passed: true,
            score: 80,
            completedAt: new Date(),
            module: { id: 'm1', title: 'Mod 1', order: 1, courseId: ACTIVE },
          },
          {
            moduleId: 'm2',
            passed: false,
            score: 50,
            completedAt: null,
            module: { id: 'm2', title: 'Mod 2', order: 2, courseId: ACTIVE },
          },
          {
            moduleId: 'x1',
            passed: true,
            score: 90,
            completedAt: new Date(),
            module: { id: 'x1', title: 'Demonstration 1', order: 1, courseId: OTHER },
          },
        ],
        certificates: [],
      });

    const arrangeProfile = (activeCourseId: string | null) => {
      const candidate = twoCourseCandidate();
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsSettings.findFirst.mockResolvedValue(
        activeCourseId === null ? null : { activeCourseId },
      );
      prisma.kbsModule.count.mockImplementation(countByCourse);
      return candidate;
    };

    it('counts the active course on both sides of the ratio', async () => {
      const candidate = arrangeProfile(ACTIVE);

      const result = await service.getMyProfile(candidate.userId);

      // 1 of 3. Unscoped on either side this reads 2 of 3, 1 of 5 or 2 of 5,
      // none of which is progress through the active course.
      expect(result.overallProgress).toEqual({ completed: 1, total: 3, percent: 33 });
    });

    it('lists the active course modules and no others', async () => {
      const candidate = arrangeProfile(ACTIVE);

      const result = await service.getMyProfile(candidate.userId);

      expect(result.modules.map((m) => m.moduleId)).toEqual(['m1', 'm2']);
    });

    /** I38 - absence behaviour, matching `getMyOverview`: a state, not a 500. */
    it('reports no course progress when no course is active', async () => {
      const candidate = arrangeProfile(null);

      const result = await service.getMyProfile(candidate.userId);

      expect({ overall: result.overallProgress, modules: result.modules }).toEqual({
        overall: { completed: 0, total: 0, percent: 0 },
        modules: [],
      });
    });

    it('throws NotFoundException if not enrolled', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(null);

      await expect(service.getMyProfile('u1')).rejects.toThrow(NotFoundException);
    });
  });

  // ----- SUBMIT QUIZ ----- //

  describe('submitQuiz', () => {
    /**
     * The fixtures separate the module POOL from the QUIZ LENGTH on purpose.
     *
     * The tests this block replaces used a pool of two questions and submitted
     * two answers. Pool and quiz length were the same number, so
     * `correctCount / questions.length` and `correctCount / quizLength` were
     * indistinguishable and the denominator defect could not appear. On dev,
     * with a pool of 30 and a quiz of 10, a candidate who answered all ten
     * correctly scored 33% and failed: nobody could pass a quiz, so nobody
     * could reach the exam.
     *
     * A fixture where two different quantities happen to be equal cannot tell
     * you which one the code used.
     */
    const POOL = 30;
    const QUIZ_LENGTH = 10;

    const pool = Array.from({ length: POOL }, (_, i) => ({
      id: `q${i + 1}`,
      answers: [{ id: `a${i + 1}`, isCorrect: true }],
    }));

    const answersFor = (count: number, wrong = 0) =>
      Array.from({ length: count }, (_, i) => ({
        questionId: `q${i + 1}`,
        answerIds: [i < count - wrong ? `a${i + 1}` : 'a_wrong'],
      }));

    const quizDto = { answers: answersFor(QUIZ_LENGTH) };

    const arrangeQuiz = () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(buildCandidate({ status: 'IN_TRAINING' }));
      prisma.kbsModule.findUnique.mockResolvedValue(
        buildModule({ id: 'mod1', order: 1, course: { id: 'c1' } }),
      );
      prisma.kbsModule.findMany.mockResolvedValue([]); // no prerequisites
      // I38 - the settings mock carries the module's own course. Without it
      // this fixture had no course context at all, which is why none of these
      // tests could ever have caught a quiz submitted against a foreign module.
      prisma.kbsSettings.findFirst.mockResolvedValue({
        quizQuestionCount: QUIZ_LENGTH,
        activeCourseId: 'c1',
      });
      prisma.kbsQuestion.findMany.mockResolvedValue(pool);
      prisma.kbsCandidateProgress.upsert.mockResolvedValue({});
      prisma.kbsCandidateProgress.count.mockResolvedValue(0);
      prisma.kbsModule.count.mockResolvedValue(3);
    };

    it('scores out of the quiz length, not the module pool', async () => {
      arrangeQuiz();

      const result = await service.submitQuiz('u1', 'mod1', quizDto);

      expect(result.correctCount).toBe(QUIZ_LENGTH);
      expect(result.totalQuestions).toBe(QUIZ_LENGTH);
      // 10/10, not 10/30. The defect scored this 33 and failed the candidate.
      expect(result.score).toBe(100);
      expect(result.passed).toBe(true);
    });

    it('fails quiz when score < MODULE_PASSING_SCORE', async () => {
      arrangeQuiz();

      // 5 of 10 correct -> 50% < 70%
      const result = await service.submitQuiz('u1', 'mod1', {
        answers: answersFor(QUIZ_LENGTH, 5),
      });

      expect(result.score).toBe(50);
      expect(result.passed).toBe(false);
    });

    /**
     * I21 - one question answered ten times is not ten answers.
     *
     * The grading loop had no "already seen" set: the same correct question id
     * sent as all ten entries scored 10/10. A candidate needed to know one answer
     * to pass a module. The schema now refuses duplicates; the service refuses
     * them too, for any caller that does not come through the DTO.
     */
    it('refuses a submission that repeats a question id', async () => {
      arrangeQuiz();
      const same = Array.from({ length: QUIZ_LENGTH }, () => ({
        questionId: 'q1',
        answerIds: ['a1'],
      }));

      await expect(service.submitQuiz('u1', 'mod1', { answers: same })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.kbsCandidateProgress.upsert).not.toHaveBeenCalled();
    });

    /**
     * A candidate who has passed everything and cannot sit the exam must not be
     * silent.
     *
     * `checkAndTransitionToExamPending` reads `kbsSettings.activeCourseId` and
     * returned early when it was null. The seed never set it, so on dev a
     * candidate passed both modules, stayed `IN_TRAINING`, and `eligibility`
     * answered "finish all the modules" to somebody who had finished all the
     * modules. Nothing was logged and nothing failed.
     */
    /**
     * I38 - INVERTED, deliberately, and this is a behaviour change.
     *
     * This asserted that with no active course the submission still SUCCEEDED
     * and the stranding was merely logged. That was the right assertion while
     * `submitQuiz` had no perimeter: the alternative then was silence. It is
     * the wrong assertion now, because "no active course" means nothing is in
     * scope, and accepting a passed row against a course that does not exist is
     * the very write this subject exists to stop.
     *
     * The log it pinned is not lost: `checkAndTransitionToExamPending` still
     * carries it, for the case where a course IS configured and the transition
     * cannot run. What changes is that a write is no longer accepted first.
     */
    it('refuses a submission when no active course is configured, rather than banking it', async () => {
      arrangeQuiz();
      prisma.kbsSettings.findFirst.mockResolvedValue({
        quizQuestionCount: QUIZ_LENGTH,
        activeCourseId: null,
      });

      await expect(service.submitQuiz('u1', 'mod1', quizDto)).rejects.toThrow(NotFoundException);
      expect(prisma.kbsCandidateProgress.upsert).not.toHaveBeenCalled();
    });

    it('transitions to EXAM_PENDING once every module of the active course is passed', async () => {
      arrangeQuiz();
      // I38 - 'c1', matching the module arrangeQuiz builds. This said
      // 'course-1' against a module in 'c1': an inconsistency the code could
      // not see before the perimeter guard existed.
      prisma.kbsSettings.findFirst.mockResolvedValue({
        quizQuestionCount: QUIZ_LENGTH,
        activeCourseId: 'c1',
      });
      prisma.kbsModule.count.mockResolvedValue(2);
      prisma.kbsCandidateProgress.count.mockResolvedValue(2);
      prisma.kbsCandidate.updateMany.mockResolvedValue({ count: 1 });

      await service.submitQuiz('u1', 'mod1', quizDto);

      expect(prisma.kbsCandidate.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'EXAM_PENDING' },
        }),
      );
    });

    it('refuses a submission that does not cover the whole quiz, and names both numbers', async () => {
      arrangeQuiz();

      // Scoring 9 answers out of 9 would let a client submit only the answers it
      // is sure of and score 100%.
      await expect(
        service.submitQuiz('u1', 'mod1', { answers: answersFor(QUIZ_LENGTH - 1) }),
      ).rejects.toThrow(/reçu 9, attendu 10/);
    });

    it('rejects if candidate status is not IN_TRAINING or CANDIDATE', async () => {
      const candidate = buildCandidate({ status: 'CERTIFIED' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);

      await expect(service.submitQuiz('u1', 'mod1', quizDto)).rejects.toThrow(ForbiddenException);
    });

    it('enforces prerequisite completion before quiz', async () => {
      const candidate = buildCandidate({ status: 'IN_TRAINING' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsModule.findUnique.mockResolvedValue(
        buildModule({ order: 2, course: { id: 'c1' } }),
      );
      // I38 - the module is INSIDE the active course here on purpose. Without
      // this the perimeter guard would refuse first and the test would pass for
      // the wrong reason, proving nothing about prerequisites. It is also the
      // evidence that the prerequisite check is NOT made redundant by the
      // guard: same course, still refused, because the earlier module is unpassed.
      prisma.kbsSettings.findFirst.mockResolvedValue({
        quizQuestionCount: QUIZ_LENGTH,
        activeCourseId: 'c1',
      });
      // Module order=1 exists as a prerequisite
      prisma.kbsModule.findMany.mockResolvedValue([{ id: 'mod_prev' }]);
      prisma.kbsCandidateProgress.count.mockResolvedValue(0); // not completed

      await expect(service.submitQuiz('u1', 'mod2', quizDto)).rejects.toThrow(ForbiddenException);
    });
  });

  // ----- UPDATE STATUS (Admin) ----- //

  describe('updateStatus', () => {
    it('transitions CANDIDATE → IN_TRAINING', async () => {
      const candidate = buildCandidate({ status: 'CANDIDATE' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsCandidate.update.mockResolvedValue({
        ...candidate,
        status: 'IN_TRAINING',
      });

      const result = await service.updateStatus(candidate.id, 'admin-1', {
        status: 'IN_TRAINING',
      });

      expect(result.status).toBe('IN_TRAINING');
    });

    /**
     * I15 - the certificate is the truth, and the role reflects it.
     *
     * `EXAM_PASSED -> CERTIFIED` through this endpoint set the status and
     * granted KCA_CERTIFIED without creating a certificate: the platform then
     * treated as certified somebody whose number `/verify-certificate` would
     * answer "non reconnu". Issuing the certificate
     * (`KbsCertificatesService.issueCertificate`) is the one act that sets the
     * status, grants the role and creates the document together.
     */
    it('refuses EXAM_PASSED -> CERTIFIED: only issuing a certificate certifies', async () => {
      const candidate = buildCandidate({ status: 'EXAM_PASSED', userId: 'u1' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);

      await expect(
        service.updateStatus(candidate.id, 'admin-1', { status: 'CERTIFIED' }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.kbsCandidate.update).not.toHaveBeenCalled();
      expect(usersService.addRole).not.toHaveBeenCalled();
    });

    /**
     * The state machine, stated as a test rather than as a comment.
     *
     * `EXAM_PENDING -> CERTIFIED` was the transition grading used, and it is the
     * one that let the API call somebody certified with no certificate. It is
     * now not a legal transition at all: certification is reachable only through
     * EXAM_PASSED, and only issuance performs it.
     */
    it('refuses EXAM_PENDING -> CERTIFIED: passing is not issuing', async () => {
      const candidate = buildCandidate({ status: 'EXAM_PENDING', userId: 'u1' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);

      await expect(
        service.updateStatus(candidate.id, 'admin-1', { status: 'CERTIFIED' }),
      ).rejects.toThrow();

      expect(usersService.addRole).not.toHaveBeenCalled();
    });

    it('allows EXAM_PENDING -> EXAM_PASSED without granting anything', async () => {
      const candidate = buildCandidate({ status: 'EXAM_PENDING', userId: 'u1' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsCandidate.update.mockResolvedValue({ ...candidate, status: 'EXAM_PASSED' });

      const result = await service.updateStatus(candidate.id, 'admin-1', {
        status: 'EXAM_PASSED',
      });

      expect(result.status).toBe('EXAM_PASSED');
      expect(usersService.addRole).not.toHaveBeenCalled();
    });

    it('rejects invalid state transitions', async () => {
      const candidate = buildCandidate({ status: 'CANDIDATE' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);

      // CANDIDATE → CERTIFIED is not allowed
      await expect(
        service.updateStatus(candidate.id, 'admin-1', { status: 'CERTIFIED' }),
      ).rejects.toThrow();
    });
  });

  // ----- CROSS-MODULE INTERFACE ----- //

  describe('isUserCertified', () => {
    it('returns true for CERTIFIED candidate', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue({
        status: 'CERTIFIED',
        certificates: [
          {
            kcaNumber: 'KCA-20250101-0001',
            validUntil: new Date(Date.now() + 86_400_000) /* +1 day */,
            revokedAt: null,
          },
        ],
      });
      expect(await service.isUserCertified('u1')).toBe(true);
    });

    it('returns false for non-certified candidate', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue({
        status: 'IN_TRAINING',
      });
      expect(await service.isUserCertified('u1')).toBe(false);
    });

    it('returns false if user is not enrolled at all', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(null);
      expect(await service.isUserCertified('u1')).toBe(false);
    });

    /**
     * I15 - a revoked certificate certifies nobody, whatever the status says.
     *
     * This read `status` and `validUntil` and never `revokedAt`. It was right
     * only because `revokeCertificate` also happens to reset the status - the
     * answer rested on a side effect in another service.
     */
    it('returns false when the certificate is revoked, even with status CERTIFIED', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue({
        status: 'CERTIFIED',
        certificates: [
          {
            kcaNumber: 'KCA-20250101-0001',
            validUntil: new Date(Date.now() + 86_400_000),
            revokedAt: new Date(),
          },
        ],
      });
      expect(await service.isUserCertified('u1')).toBe(false);
    });

    it('returns false when the certificate has expired', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue({
        status: 'CERTIFIED',
        certificates: [
          {
            kcaNumber: 'KCA-20250101-0001',
            validUntil: new Date(Date.now() - 86_400_000),
            revokedAt: null,
          },
        ],
      });
      expect(await service.isUserCertified('u1')).toBe(false);
    });
  });
});
