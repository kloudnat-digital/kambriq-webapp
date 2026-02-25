import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../../../core/users/users.service';
import { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import { comparePassword, EmailService } from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';
import { ConfigService } from '@nestjs/config';

jest.mock('@kambriq/common', () => {
  const actual = jest.requireActual('@kambriq/common');
  return {
    ...actual,
    hashPassword: jest.fn().mockResolvedValue('$2b$10$newhash'),
    comparePassword: jest.fn(),
  };
});
import {
  mockConfigService,
  mockCorePrisma,
  mockEmailService,
  mockI18n,
  resetIdCounter,
} from '../../utils';
import {
  buildRole,
  buildUser,
  buildUserWithRoles,
  buildVerificationToken,
} from '../../utils/factories';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof mockCorePrisma>;
  let email: ReturnType<typeof mockEmailService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    resetIdCounter();
    prisma = mockCorePrisma();
    email = mockEmailService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: CorePrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
        { provide: I18nService, useValue: mockI18n() },
        { provide: ConfigService, useValue: mockConfigService() },
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

  // ----- REMOVE ROLE ----- //

  describe('removeRole', () => {
    it('deletes the userRole record when role exists', async () => {
      prisma.role.findUnique.mockResolvedValue(buildRole('KCA_CERTIFIED'));
      prisma.userRole.deleteMany.mockResolvedValue({ count: 1 });

      await service.removeRole('u1', 'KCA_CERTIFIED');

      expect(prisma.userRole.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) }),
      );
    });

    it('is a no-op when role does not exist in the DB', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await service.removeRole('u1', 'FAKE_ROLE');

      expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ----- CHANGE PASSWORD ----- //

  describe('changePassword', () => {
    it('updates password hash and revokes all refresh tokens', async () => {
      const user = buildUser({ id: 'u1', passwordHash: '$2b$10$hashdpassword' });
      prisma.user.findUnique.mockResolvedValue(user);

      (comparePassword as jest.Mock).mockResolvedValue(true);

      prisma.$transaction.mockResolvedValue([{}, { count: 2 }]);

      const result = await service.changePassword('u1', {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456@',
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'passwordResetConfirmation' }),
      );
      expect(result).toHaveProperty('message');
    });

    it('throws when current password is wrong', async () => {
      const user = buildUser({ id: 'u1', passwordHash: '$2b$10$hashdpassword' });
      prisma.user.findUnique.mockResolvedValue(user);

      (comparePassword as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('u1', {
          currentPassword: 'WrongPass!',
          newPassword: 'NewPass456@',
        }),
      ).rejects.toThrow();
    });
  });

  // ----- REQUEST EMAIL CHANGE ----- //

  describe('requestEmailChange', () => {
    it('stores pendingEmail, creates token, and sends verification email', async () => {
      const user = buildUser({
        id: 'u1',
        email: 'old@kambriq.com',
        passwordHash: '$2b$10$hashdpassword',
      });
      prisma.user.findUnique
        .mockResolvedValueOnce(user)       // service lookup
        .mockResolvedValueOnce(null);       // uniqueness check for new email

      (comparePassword as jest.Mock).mockResolvedValue(true);

      prisma.verificationToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.requestEmailChange('u1', {
        newEmail: 'new@kambriq.com',
        currentPassword: 'Pass123!',
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'emailChangeRequest', to: 'new@kambriq.com' }),
      );
      expect(result).toHaveProperty('message');
    });

    it('throws when new email equals current email', async () => {
      const user = buildUser({ id: 'u1', email: 'same@kambriq.com' });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.requestEmailChange('u1', {
          newEmail: 'SAME@kambriq.com',
          currentPassword: 'Pass123!',
        }),
      ).rejects.toThrow();
    });

    it('throws ConflictException when new email is already taken', async () => {
      const user = buildUser({ id: 'u1', email: 'old@kambriq.com', passwordHash: '$2b$10$x' });
      const other = buildUser({ email: 'taken@kambriq.com' });

      prisma.user.findUnique
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(other);  // uniqueness check — email taken

      (comparePassword as jest.Mock).mockResolvedValue(true);

      await expect(
        service.requestEmailChange('u1', {
          newEmail: 'taken@kambriq.com',
          currentPassword: 'Pass123!',
        }),
      ).rejects.toThrow();
    });
  });

  // ----- CONFIRM EMAIL CHANGE ----- //

  describe('confirmEmailChange', () => {
    it('swaps email, marks token used, and revokes sessions', async () => {
      const token = buildVerificationToken({
        userId: 'u1',
        type: 'EMAIL_CHANGE',
        expiresAt: new Date(Date.now() + 86_400_000),
        usedAt: null,
      });
      prisma.verificationToken.findUnique.mockResolvedValue(token);
      prisma.user.findUnique
        .mockResolvedValueOnce({
          email: 'old@kambriq.com',
          pendingEmail: 'new@kambriq.com',
          preferredLanguage: 'fr',
          firstName: 'John',
        })
        .mockResolvedValueOnce(null); // uniqueness check

      prisma.$transaction.mockResolvedValue([{}, {}, { count: 1 }]);

      const result = await service.confirmEmailChange('u1', { token: token.token });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'emailChangeConfirm', to: 'old@kambriq.com' }),
      );
      expect(result).toHaveProperty('message');
    });

    it('throws when token is invalid or expired', async () => {
      prisma.verificationToken.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmEmailChange('u1', { token: 'bad-token' }),
      ).rejects.toThrow();
    });

    it('throws when token belongs to a different user', async () => {
      const token = buildVerificationToken({
        userId: 'other-user',
        type: 'EMAIL_CHANGE',
        expiresAt: new Date(Date.now() + 86_400_000),
        usedAt: null,
      });
      prisma.verificationToken.findUnique.mockResolvedValue(token);

      await expect(
        service.confirmEmailChange('u1', { token: token.token }),
      ).rejects.toThrow();
    });
  });

  // ----- SUBMIT ID DOCUMENT ----- //

  describe('submitIdDocument', () => {
    it('upserts profile with PENDING status', async () => {
      const user = buildUser({ id: 'u1', profile: { idVerificationStatus: 'none' } });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.userProfile.upsert.mockResolvedValue({});

      const result = await service.submitIdDocument('u1', {
        idDocumentUrl: 'https://s3.example.com/docs/id.jpg',
      });

      expect(prisma.userProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ idVerificationStatus: 'pending' }),
        }),
      );
      expect(result).toHaveProperty('message');
    });

    it('throws ForbiddenException if identity is already verified', async () => {
      const user = buildUser({
        id: 'u1',
        profile: { idVerificationStatus: 'verified' },
      });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.submitIdDocument('u1', { idDocumentUrl: 'https://s3.example.com/new.jpg' }),
      ).rejects.toThrow();
    });
  });

  // ----- REVIEW ID DOCUMENT ----- //

  describe('reviewIdDocument', () => {
    const pendingProfile = {
      userId: 'u1',
      idDocumentUrl: 'https://s3.example.com/doc.jpg',
      idVerificationStatus: 'pending',
      user: { email: 'u@test.com', firstName: 'John', preferredLanguage: 'fr' },
    };

    it('sets status to verified and sends idVerified email', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(pendingProfile);
      prisma.userProfile.update.mockResolvedValue({});

      await service.reviewIdDocument('u1', 'admin-1', { status: 'verified' });

      expect(prisma.userProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ idVerificationStatus: 'verified' }),
        }),
      );
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'idVerified' }),
      );
    });

    it('sets status to rejected, stores reason, and sends idRejected email', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(pendingProfile);
      prisma.userProfile.update.mockResolvedValue({});

      await service.reviewIdDocument('u1', 'admin-1', {
        status: 'rejected',
        rejectionReason: 'Document unclear',
      });

      expect(prisma.userProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            idVerificationStatus: 'rejected',
            idRejectionReason: 'Document unclear',
          }),
        }),
      );
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'idRejected' }),
      );
    });

    it('throws NotFoundException when no document is pending', async () => {
      prisma.userProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.reviewIdDocument('u1', 'admin-1', { status: 'verified' }),
      ).rejects.toThrow();
    });

    it('throws BadRequestException when document is not in PENDING status', async () => {
      prisma.userProfile.findUnique.mockResolvedValue({
        ...pendingProfile,
        idVerificationStatus: 'verified',
      });

      await expect(
        service.reviewIdDocument('u1', 'admin-1', { status: 'verified' }),
      ).rejects.toThrow();
    });
  });

  // ----- FIND OR CREATE CLIENT USER ----- //

  describe('findOrCreateClientUser', () => {
    it('returns existing user without sending email', async () => {
      const existing = buildUser({ email: 'existing@test.com' });
      prisma.user.findUnique.mockResolvedValue(existing);

      const result = await service.findOrCreateClientUser(
        'EXISTING@TEST.COM',
        'Jane',
        'Smith',
      );

      expect(result.isNew).toBe(false);
      expect(result.email).toBe(existing.email);
      expect(email.send).not.toHaveBeenCalled();
    });

    it('creates new user, assigns client role, and sends invite email', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // no existing user
      const newUser = buildUser({ email: 'new@test.com' });
      prisma.user.create.mockResolvedValue(newUser);
      prisma.role.findUnique.mockResolvedValue(buildRole('client'));
      prisma.userRole.create.mockResolvedValue({});
      prisma.verificationToken.create.mockResolvedValue({});

      const result = await service.findOrCreateClientUser(
        'new@test.com',
        'Jane',
        'Smith',
      );

      expect(result.isNew).toBe(true);
      expect(prisma.verificationToken.create).toHaveBeenCalled();
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'inviteUser' }),
      );
    });
  });
});
