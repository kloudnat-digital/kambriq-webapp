import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
    it('returns profile with progress summary', async () => {
      const candidate = buildCandidate({
        progress: [
          {
            moduleId: 'm1',
            passed: true,
            score: 80,
            completedAt: new Date(),
            module: { id: 'm1', title: 'Mod 1', order: 1 },
          },
          {
            moduleId: 'm2',
            passed: false,
            score: 50,
            completedAt: null,
            module: { id: 'm2', title: 'Mod 2', order: 2 },
          },
        ],
        certificate: null,
      });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsModule.count.mockResolvedValue(3);

      const result = await service.getMyProfile(candidate.userId);

      expect(result.overallProgress.completed).toBe(1);
      expect(result.overallProgress.total).toBe(3);
      expect(result.overallProgress.percent).toBe(33); // 1/3
      expect(result.modules).toHaveLength(2);
    });

    it('throws NotFoundException if not enrolled', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(null);

      await expect(service.getMyProfile('u1')).rejects.toThrow(NotFoundException);
    });
  });

  // ----- SUBMIT QUIZ ----- //

  describe('submitQuiz', () => {
    const quizDto = {
      answers: [
        { questionId: 'q1', answerIds: ['a1'] },
        { questionId: 'q2', answerIds: ['a3'] },
      ],
    };

    it('grades quiz and returns score + pass/fail', async () => {
      const candidate = buildCandidate({ status: 'IN_TRAINING' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);

      const mod = buildModule({ id: 'mod1', order: 1, course: { id: 'c1' } });
      prisma.kbsModule.findUnique.mockResolvedValue(mod);
      prisma.kbsModule.findMany.mockResolvedValue([]); // no prerequisites

      // Two questions, candidate answers both correctly
      prisma.kbsQuestion.findMany.mockResolvedValue([
        { id: 'q1', answers: [{ id: 'a1', isCorrect: true }] },
        { id: 'q2', answers: [{ id: 'a3', isCorrect: true }] },
      ]);
      prisma.kbsCandidateProgress.upsert.mockResolvedValue({});
      prisma.kbsCandidateProgress.count.mockResolvedValue(0);
      prisma.kbsModule.count.mockResolvedValue(3);

      const result = await service.submitQuiz('u1', 'mod1', quizDto);

      expect(result.score).toBe(100);
      expect(result.passed).toBe(true);
      expect(result.correctCount).toBe(2);
      expect(result.totalQuestions).toBe(2);
    });

    it('fails quiz when score < MODULE_PASSING_SCORE', async () => {
      const candidate = buildCandidate({ status: 'IN_TRAINING' });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsModule.findUnique.mockResolvedValue(
        buildModule({ order: 1, course: { id: 'c1' } }),
      );
      prisma.kbsModule.findMany.mockResolvedValue([]);

      // 2 questions, candidate gets 1 wrong → 50% < 70%
      prisma.kbsQuestion.findMany.mockResolvedValue([
        { id: 'q1', answers: [{ id: 'a1', isCorrect: true }] },
        { id: 'q2', answers: [{ id: 'a3', isCorrect: true }] },
      ]);
      prisma.kbsCandidateProgress.upsert.mockResolvedValue({});

      const result = await service.submitQuiz('u1', 'mod1', {
        answers: [
          { questionId: 'q1', answerIds: ['a1'] }, // correct
          { questionId: 'q2', answerIds: ['a_wrong'] }, // wrong
        ],
      });

      expect(result.score).toBe(50);
      expect(result.passed).toBe(false);
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

    it('grants KCA_CERTIFIED role on transition to CERTIFIED', async () => {
      const candidate = buildCandidate({
        status: 'EXAM_PENDING',
        userId: 'u1',
      });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsCandidate.update.mockResolvedValue({
        ...candidate,
        status: 'CERTIFIED',
      });

      await service.updateStatus(candidate.id, 'admin-1', {
        status: 'CERTIFIED',
      });

      expect(usersService.addRole).toHaveBeenCalledWith('u1', 'KCA_CERTIFIED', 'admin-1');
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
        certificate: {
          validUntil: new Date(Date.now() + 86_400_000) /* +1 day */,
        },
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
  });
});
