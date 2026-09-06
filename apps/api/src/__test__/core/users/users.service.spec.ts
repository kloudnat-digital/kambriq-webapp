import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { RoleCode } from '@kambriq/common';
import { UsersService } from '../../../core/users/users.service';
import { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import { comparePassword, EmailService, StorageService } from '@kambriq/common';
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
  mockStorageService,
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
        { provide: StorageService, useValue: mockStorageService() },
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
      prisma.$transaction.mockImplementation((cb: (client: unknown) => Promise<unknown>) =>
        cb({
          userRole: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
        }),
      );

      await service.adminUpdate(user.id, { roleCodes: ['CLIENT', 'ADMIN_KBS'] }, 'admin-1');

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
        service.adminUpdate(user.id, { roleCodes: ['CLIENT', 'INVALID'] }, 'admin-1'),
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

    it('is idempotent - does nothing if role already exists', async () => {
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
    /**
     * The assertion this replaces checked `toHaveLength(2)` and `meta.total`.
     *
     * It was green while the endpoint served
     * `{"success":true,"data":[{},{},{}],"meta":{"total":14,…}}` — because
     * `toUserResponse` is async and the map was not awaited, so `data` was an
     * array of pending Promises. **An array of two Promises has length two.**
     * Length could not tell the two cases apart, and neither could the envelope
     * or the pagination.
     *
     * Assert on content. Shape and count are exactly what a defect of this kind
     * preserves.
     */
    it('returns users, not promises', async () => {
      const users = [
        buildUserWithRoles([RoleCode.CLIENT]),
        buildUserWithRoles([RoleCode.ADMIN_GLOBAL]),
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

      // The rows carry the answer, and a Promise serialises to `{}`.
      for (const row of result.data) {
        expect(row).not.toBeInstanceOf(Promise);
        expect(Object.keys(row as object).length).toBeGreaterThan(0);
        expect(row).toHaveProperty('email');
        expect(row).toHaveProperty('id');
      }

      expect(result.data[0]).toMatchObject({ roles: [RoleCode.CLIENT] });
      expect(JSON.parse(JSON.stringify(result.data[0]))).toHaveProperty('email');
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
        .mockResolvedValueOnce(user) // service lookup
        .mockResolvedValueOnce(null); // uniqueness check for new email

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

      prisma.user.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce(other); // uniqueness check - email taken

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

      await expect(service.confirmEmailChange('u1', { token: 'bad-token' })).rejects.toThrow();
    });

    it('throws when token belongs to a different user', async () => {
      const token = buildVerificationToken({
        userId: 'other-user',
        type: 'EMAIL_CHANGE',
        expiresAt: new Date(Date.now() + 86_400_000),
        usedAt: null,
      });
      prisma.verificationToken.findUnique.mockResolvedValue(token);

      await expect(service.confirmEmailChange('u1', { token: token.token })).rejects.toThrow();
    });
  });

  // ----- SUBMIT ID DOCUMENT ----- //

  describe('submitIdDocument', () => {
    it('upserts profile with PENDING status', async () => {
      const user = buildUser({ id: 'u1', profile: { idVerificationStatus: 'none' } });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.userProfile.upsert.mockResolvedValue({});

      const result = await service.submitIdDocument('u1', {
        idDocumentUrls: ['https://s3.example.com/docs/id.jpg'],
      });

      expect(prisma.userProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ idVerificationStatus: 'pending' }),
        }),
      );
      expect(result).toHaveProperty('id', 'u1');
    });

    it('throws ForbiddenException if identity is already verified', async () => {
      const user = buildUser({
        id: 'u1',
        profile: { idVerificationStatus: 'verified' },
      });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.submitIdDocument('u1', {
          idDocumentUrls: ['https://s3.example.com/new.jpg'],
        }),
      ).rejects.toThrow();
    });
  });

  // ----- REVIEW ID DOCUMENT ----- //

  describe('reviewIdDocument', () => {
    const pendingProfile = {
      userId: 'u1',
      idDocumentUrls: ['https://s3.example.com/doc.jpg'],
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
      expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ template: 'idVerified' }));
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
      expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ template: 'idRejected' }));
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

      const result = await service.findOrCreateClientUser('EXISTING@TEST.COM', 'Jane', 'Smith');

      expect(result.isNew).toBe(false);
      expect(result.email).toBe(existing.email);
      expect(email.send).not.toHaveBeenCalled();
    });

    /**
     * The test this replaces was called "creates new user, **assigns client
     * role**, and sends invite email" and never asserted the role.
     *
     * Its mock returned `buildRole('client')` for any lookup, so the real defect
     * — querying `code: 'client'` against a stored `'CLIENT'`, getting `null`,
     * and creating a user with no roles — could not appear. The name claimed the
     * behaviour; the assertions covered the two things either side of it.
     */
    const arrangeNewUser = () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(buildUser({ id: 'new-1', email: 'new@test.com' }));
      prisma.userRole.create.mockResolvedValue({});
      prisma.verificationToken.create.mockResolvedValue({});
    };

    it('looks the role up by the constant, and actually assigns it', async () => {
      arrangeNewUser();
      // Answers only for the exact stored code. A mock that answers for anything
      // is how the casing defect stayed invisible.
      prisma.role.findUnique.mockImplementation((args: { where: { code: string } }) =>
        Promise.resolve(
          args.where.code === RoleCode.CLIENT ? buildRole(RoleCode.CLIENT, { id: 'role-c' }) : null,
        ),
      );

      const result = await service.findOrCreateClientUser('new@test.com', 'Jane', 'Smith');

      expect(result.isNew).toBe(true);
      expect(prisma.role.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { code: RoleCode.CLIENT } }),
      );
      expect(prisma.userRole.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { userId: 'new-1', roleId: 'role-c' } }),
      );
      expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ template: 'inviteUser' }));
    });

    it('fails loudly when the client role is missing, instead of creating a roleless user', async () => {
      arrangeNewUser();
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(service.findOrCreateClientUser('new@test.com', 'Jane', 'Smith')).rejects.toThrow(
        /CLIENT role is missing/,
      );

      // The old code carried on: user row created, no role, invite email sent.
      expect(prisma.userRole.create).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
    });
  });

  /**
   * H4 - the last global administrator cannot be removed, by any door.
   *
   * ADMIN_GLOBAL implies every other role and is the only role that can grant or
   * revoke ADMIN_GLOBAL. Remove the last one and there is no route back: no
   * remaining account can appoint a replacement, and recovery becomes a manual
   * database write.
   *
   * Four doors, tested separately because they do not look alike. The fourth -
   * `adminUpdate` with a `roleCodes` list that omits ADMIN_GLOBAL - is the one
   * that gets forgotten: it is an update, not a deletion, and it removes the role
   * as a side effect of replacing the set.
   */
  describe('the last super admin cannot be removed', () => {
    const SUPER_ROLE = { id: 'role-sa', code: RoleCode.ADMIN_GLOBAL };

    /** target holds ADMIN_GLOBAL; `holders` = how many ACTIVE accounts hold it. */
    const arrange = (holders: number, targetHolds = true) => {
      prisma.role.findUnique.mockResolvedValue(SUPER_ROLE);
      prisma.userRole.findFirst.mockResolvedValue(
        targetHolds ? { userId: 'u1', roleId: SUPER_ROLE.id } : null,
      );
      prisma.userRole.count.mockResolvedValue(holders);
    };

    describe('door 1 - the holder deletes their own account', () => {
      it('refuses when they are the last active holder', async () => {
        prisma.user.findUnique.mockResolvedValue(buildUser({ id: 'u1' }));
        arrange(1);

        await expect(service.deleteMe('u1')).rejects.toThrow('user.lastSuperAdminDelete');
        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('allows it when another active holder exists', async () => {
        prisma.user.findUnique.mockResolvedValue(buildUser({ id: 'u1' }));
        arrange(2);
        prisma.user.update.mockResolvedValue({});
        prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

        await expect(service.deleteMe('u1')).resolves.toBeDefined();
        expect(prisma.user.update).toHaveBeenCalled();
      });
    });

    describe('door 2 - an administrator blocks the account', () => {
      it('refuses when they are the last active holder', async () => {
        prisma.user.findUnique.mockResolvedValue(buildUser({ id: 'u1', isActive: true }));
        arrange(1);

        await expect(service.blockUser('u1', 'admin-1')).rejects.toThrow(
          'user.lastSuperAdminDelete',
        );
        expect(prisma.user.update).not.toHaveBeenCalled();
      });
    });

    describe('door 3 - the role is revoked directly', () => {
      it('refuses when they are the last active holder', async () => {
        arrange(1);

        await expect(service.removeRole('u1', RoleCode.ADMIN_GLOBAL)).rejects.toThrow(
          'user.lastSuperAdminDemote',
        );
        expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
      });

      it('does not interfere with revoking any other role', async () => {
        prisma.role.findUnique.mockResolvedValue({ id: 'role-kbs', code: RoleCode.ADMIN_KBS });
        prisma.userRole.deleteMany.mockResolvedValue({ count: 1 });

        await expect(service.removeRole('u1', RoleCode.ADMIN_KBS)).resolves.toBeUndefined();
        expect(prisma.userRole.deleteMany).toHaveBeenCalled();
      });
    });

    describe('door 4 - the destructive replace that omits the role', () => {
      it('refuses when the new list drops ADMIN_GLOBAL from the last holder', async () => {
        prisma.user.findUnique.mockResolvedValue(buildUser({ id: 'u1' }));
        prisma.role.findMany.mockResolvedValue([{ id: 'role-kbs', code: RoleCode.ADMIN_KBS }]);
        arrange(1);

        await expect(
          service.adminUpdate('u1', { roleCodes: [RoleCode.ADMIN_KBS] }, 'admin-1'),
        ).rejects.toThrow('user.lastSuperAdminDemote');
        expect(prisma.$transaction).not.toHaveBeenCalled();
      });

      it('allows a replace that keeps ADMIN_GLOBAL', async () => {
        prisma.user.findUnique.mockResolvedValue(buildUser({ id: 'u1' }));
        prisma.role.findMany.mockResolvedValue([
          { id: 'role-sa', code: RoleCode.ADMIN_GLOBAL },
          { id: 'role-kbs', code: RoleCode.ADMIN_KBS },
        ]);
        arrange(1);
        prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
          cb({ userRole: { deleteMany: jest.fn(), createMany: jest.fn() } }),
        );

        await expect(
          service.adminUpdate(
            'u1',
            { roleCodes: [RoleCode.ADMIN_GLOBAL, RoleCode.ADMIN_KBS] },
            'admin-1',
          ),
        ).resolves.toBeDefined();
        expect(prisma.$transaction).toHaveBeenCalled();
      });
    });

    it('a blocked administrator does not count as cover for the last active one', async () => {
      // count() is scoped to isActive: true, deletedAt: null. An account that
      // cannot log in cannot appoint a replacement, so it is not cover.
      arrange(1);
      await expect(service.removeRole('u1', RoleCode.ADMIN_GLOBAL)).rejects.toThrow();
      expect(prisma.userRole.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user: { isActive: true, deletedAt: null } }),
        }),
      );
    });

    it('both refusal messages resolve to real text in both locales', () => {
      // The guard is only as good as what it tells the operator. A key that is
      // never translated reaches the caller as the raw string
      // "user.lastSuperAdminDelete", which explains nothing and looks like a bug.
      for (const locale of ['fr', 'en']) {
        const messages = JSON.parse(
          readFileSync(
            join(__dirname, `../../../../../../libs/common/src/i18n/${locale}/user.json`),
            'utf-8',
          ),
        );
        for (const key of ['lastSuperAdminDelete', 'lastSuperAdminDemote']) {
          expect(messages[key]).toEqual(expect.any(String));
          expect(messages[key].length).toBeGreaterThan(20);
        }
        // Deletion and demotion are different acts; one message for both would
        // send an operator looking for a deleted account that still exists.
        expect(messages.lastSuperAdminDelete).not.toEqual(messages.lastSuperAdminDemote);
      }
    });
  });
});
