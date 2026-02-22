import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../../core/users/users.service';
import { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import { EmailService } from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';
import {
  mockCorePrisma,
  mockEmailService,
  mockI18n,
  resetIdCounter,
} from '../../utils';
import {
  buildRole,
  buildUser,
  buildUserWithRoles,
} from '../../utils/factories';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof mockCorePrisma>;
  let email: ReturnType<typeof mockEmailService>;

  beforeEach(async () => {
    resetIdCounter();
    prisma = mockCorePrisma();
    email = mockEmailService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: CorePrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
        { provide: I18nService, useValue: mockI18n() },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  // ----- GET ME ----- //

  describe('getMe', () => {
    it('returns sanitized user response', async () => {
      const user = buildUserWithRoles(['CLIENT']);
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getMe(user.id);

      expect(result.id).toBe(user.id);
      expect(result.email).toBe(user.email);
      expect(result.roles).toContain('CLIENT');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('language');
    });

    it('throws NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getMe('nonexistent')).rejects.toThrow();
    });
  });

  // ----- UPDATE ME ----- //

  describe('updateMe', () => {
    it('updates user fields on the User table', async () => {
      const user = buildUserWithRoles(['CLIENT']);
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(user);

      await service.updateMe(user.id, { firstName: 'Jane', language: 'en' });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
          data: expect.objectContaining({
            firstName: 'Jane',
            preferredLanguage: 'en',
          }),
        }),
      );
    });

    it('upserts profile fields on the UserProfile table', async () => {
      const user = buildUserWithRoles(['CLIENT']);
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.userProfile.upsert.mockResolvedValue({});

      await service.updateMe(user.id, {
        avatarUrl: 'https://img.test/avatar.jpg',
        city: 'Douala',
      });

      expect(prisma.userProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: user.id },
          create: expect.objectContaining({ city: 'Douala' }),
          update: expect.objectContaining({ city: 'Douala' }),
        }),
      );
    });
  });

  // ----- DELETE ME ----- //

  describe('deleteMe', () => {
    it('soft-deletes user, revokes sessions, sends email', async () => {
      const user = buildUser({ id: 'u1' });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.deleteMe('u1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: false,
            deletedAt: expect.any(Date),
            deactivatedBy: null,
          }),
        }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'accountDeletion' }),
      );
      expect(result).toHaveProperty('message');
    });
  });

  // ----- ADMIN: BLOCK / UNBLOCK ----- //

  describe('blockUser', () => {
    it('deactivates user, revokes tokens, sends email', async () => {
      const user = buildUser({ id: 'u1', isActive: true });
      prisma.user.findUnique
        .mockResolvedValueOnce(user) // findByIdOrThrow
        .mockResolvedValueOnce({ ...user, isActive: false }); // return after block
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.blockUser('u1', 'admin-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: false,
            deactivatedBy: 'admin-1',
          }),
        }),
      );
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'accountBlocked' }),
      );
    });

    it('throws if user is already inactive', async () => {
      const user = buildUser({ isActive: false });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.blockUser(user.id, 'admin-1')).rejects.toThrow();
    });
  });

  describe('unblockUser', () => {
    it('reactivates user, resets lock state, sends email', async () => {
      const user = buildUser({ id: 'u1', isActive: false });
      prisma.user.findUnique
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce({ ...user, isActive: true });
      prisma.user.update.mockResolvedValue({});

      await service.unblockUser('u1', 'admin-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: true,
            loginAttempts: 0,
            lockedUntil: null,
          }),
        }),
      );
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'accountUnblocked' }),
      );
    });

    it('throws if user is already active', async () => {
      const user = buildUser({ isActive: true });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.unblockUser(user.id, 'admin-1')).rejects.toThrow();
    });
  });

  // ----- ADMIN: UPDATE ROLES ----- //

  describe('adminUpdate', () => {
    it('replaces user roles atomically', async () => {
      const user = buildUserWithRoles(['CLIENT']);
      prisma.user.findUnique.mockResolvedValue(user);
      const roles = [buildRole('CLIENT'), buildRole('ADMIN_KBS')];
      prisma.role.findMany.mockResolvedValue(roles);
      // $transaction with async callback
      prisma.$transaction.mockImplementation(
        (cb: (client: unknown) => Promise<unknown>) =>
          cb({
            userRole: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
            },
          }),
      );

      await service.adminUpdate(
        user.id,
        { roleCodes: ['CLIENT', 'ADMIN_KBS'] },
        'admin-1',
      );

      expect(prisma.role.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { code: { in: ['CLIENT', 'ADMIN_KBS'] } },
        }),
      );
    });

    it('throws if any role code is invalid', async () => {
      const user = buildUserWithRoles(['CLIENT']);
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.role.findMany.mockResolvedValue([buildRole('CLIENT')]); // only 1 of 2 found

      await expect(
        service.adminUpdate(
          user.id,
          { roleCodes: ['CLIENT', 'INVALID'] },
          'admin-1',
        ),
      ).rejects.toThrow();
    });
  });

  // ----- ROLE HELPERS ----- //

  describe('addRole', () => {
    it('assigns a role to the user', async () => {
      prisma.role.findUnique.mockResolvedValue(buildRole('KCA_CERTIFIED'));
      prisma.userRole.findUnique.mockResolvedValue(null);
      prisma.userRole.create.mockResolvedValue({});

      await service.addRole('u1', 'KCA_CERTIFIED', 'admin-1');

      expect(prisma.userRole.create).toHaveBeenCalled();
    });

    it('is idempotent — does nothing if role already exists', async () => {
      prisma.role.findUnique.mockResolvedValue(buildRole('KCA_CERTIFIED'));
      prisma.userRole.findUnique.mockResolvedValue({ id: 'existing' });

      await service.addRole('u1', 'KCA_CERTIFIED');

      expect(prisma.userRole.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown role code', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(service.addRole('u1', 'FAKE_ROLE')).rejects.toThrow();
    });
  });

  describe('hasRole', () => {
    it('returns true when user has the role', async () => {
      prisma.userRole.count.mockResolvedValue(1);
      expect(await service.hasRole('u1', 'CLIENT')).toBe(true);
    });

    it('returns false when user lacks the role', async () => {
      prisma.userRole.count.mockResolvedValue(0);
      expect(await service.hasRole('u1', 'ADMIN_GLOBAL')).toBe(false);
    });
  });

  // ----- FIND ALL (paginated) ----- //

  describe('findAll', () => {
    it('returns paginated users', async () => {
      const users = [
        buildUserWithRoles(['CLIENT']),
        buildUserWithRoles(['ADMIN_GLOBAL']),
      ];
      prisma.$transaction.mockResolvedValue([users, 2]);

      const result = await service.findAll({
        page: 1,
        limit: 20,
        sort: 'createdAt',
        order: 'desc',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });
});
