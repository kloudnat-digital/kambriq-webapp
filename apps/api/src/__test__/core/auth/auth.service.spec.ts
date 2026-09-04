import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../../core/auth/auth.service';
import {
  buildRefreshToken,
  buildRole,
  buildUser,
  buildUserWithRoles,
  buildVerificationToken,
  mockConfigService,
  mockCorePrisma,
  mockEmailService,
  mockI18n,
  mockJwtService,
  resetIdCounter,
} from '../../utils';
import { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import { JwtService } from '@nestjs/jwt';
import { comparePassword, EmailService, RoleCode, VerificationTokenType } from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';
import { ConfigService } from '@nestjs/config';
import { AuthResponse } from '../../../core/auth/dto/auth.dto';

jest.mock('@kambriq/common', () => {
  const actual = jest.requireActual('@kambriq/common');
  return {
    ...actual,
    hashPassword: jest.fn().mockResolvedValue('$2b$10$hashed'),
    comparePassword: jest.fn(),
  };
});

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof mockCorePrisma>;
  let jwt: ReturnType<typeof mockJwtService>;
  let email: ReturnType<typeof mockEmailService>;
  let i18n: ReturnType<typeof mockI18n>;

  beforeEach(async () => {
    jest.clearAllMocks();
    resetIdCounter();
    prisma = mockCorePrisma();
    jwt = mockJwtService();
    email = mockEmailService();
    i18n = mockI18n();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: CorePrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: EmailService, useValue: email },
        { provide: I18nService, useValue: i18n },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  // ----- REGISTER ----- //

  describe('register', () => {
    const dto = {
      email: 'new@kambriq.com',
      password: 'StrongPass123!',
      firstName: 'Alice',
      lastName: 'Nkomo',
      phone: '+23769999999',
      language: 'fr' as const,
    };

    it('Creates a user, assigns CLIENT role, sends verification email, and returns tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // No existing user
      const createdUser = buildUser({ id: 'user-1', email: dto.email });
      prisma.user.create.mockResolvedValue(createdUser);
      prisma.role.findUnique.mockResolvedValue(buildRole(RoleCode.CLIENT, { id: 'role-1' }));
      prisma.userRole.create.mockResolvedValue({});
      prisma.verificationToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.verificationToken.create.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(dto);

      // User created with correct data
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: dto.email.toLowerCase(),
            firstName: dto.firstName,
            preferredLanguage: 'fr',
          }),
        }),
      );

      // CLIENT role assigned
      expect(prisma.userRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            roleId: 'role-1',
          }),
        }),
      );

      // Verification email sent
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: dto.email.toLowerCase(),
          template: 'verification',
          lang: 'fr',
        }),
      );

      // Returns tokens and user
      expect(result.user.email).toBe(dto.email.toLowerCase());
      expect(result.user.roles).toContain(RoleCode.CLIENT);
      expect(result.tokens.accessToken).toBe('jwt-access-token');
    });

    /**
     * The link has to work, not merely be sent.
     *
     * `createVerificationToken` is async. Registration called it without
     * `await`, so the template literal interpolated the Promise and every
     * verification email went out with `?token=[object Promise]`. The send
     * succeeded, SES delivered, the mailbox received it, and no new user could
     * ever verify their address.
     *
     * The assertion above this one passed throughout: it checked `to`,
     * `template` and `lang`, and never opened `args`. Asserting that an email
     * was sent is not asserting that it is usable.
     */
    it('puts the real verification token in the link, not an unresolved promise', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(buildUser({ id: 'user-1', email: dto.email }));
      prisma.role.findUnique.mockResolvedValue(buildRole(RoleCode.CLIENT, { id: 'role-1' }));
      prisma.userRole.create.mockResolvedValue({});
      prisma.verificationToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.verificationToken.create.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      await service.register(dto);

      // The token the service actually persisted.
      const createArg = prisma.verificationToken.create.mock.calls[0]?.[0] as {
        data: { token: string };
      };
      const persisted = createArg.data.token;
      expect(persisted).toMatch(/^[0-9a-f]{64}$/);

      const sendCalls = email.send.mock.calls as unknown as Array<
        [{ args: { verificationUrl: string } }]
      >;
      const sendArg = sendCalls[0][0];
      const sentUrl = sendArg.args.verificationUrl;
      expect(sentUrl).toContain(`token=${persisted}`);
      expect(sentUrl).not.toContain('[object');
    });
  });

  // ----- LOGIN ----- //

  describe('login', () => {
    const dto = { email: 'test@kambriq.com', password: 'StrongPass123!', rememberMe: false };

    it('returns tokens on valid credentials', async () => {
      const user = buildUserWithRoles(['CLIENT'], {
        email: dto.email,
        isActive: true,
        emailVerified: true,
      });

      prisma.user.findUnique.mockResolvedValue(user);
      (comparePassword as jest.Mock).mockResolvedValue(true);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login(dto);

      expect(result).toHaveProperty('tokens');
      expect(result).toHaveProperty('user');
      expect((result as AuthResponse).user.email).toBe(dto.email);
    });

    it('throws on invalid (user not found)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow();
    });

    it('throws a wrong password and increments loginAttempts', async () => {
      const user = buildUserWithRoles(['CLIENT'], {
        email: dto.email,
        emailVerified: true,
        loginAttempts: 0,
      });
      prisma.user.findUnique.mockResolvedValue(user);
      (comparePassword as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            loginAttempts: { increment: 1 },
          }),
        }),
      );
    });

    it('locks account after MAX_LOGIN_ATTEMPTS failures', async () => {
      const user = buildUserWithRoles(['CLIENT'], {
        email: dto.email,
        emailVerified: true,
        loginAttempts: 4, // one more will be 5 = locked
      });
      prisma.user.findUnique.mockResolvedValue(user);
      (comparePassword as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow();
      expect(prisma.user.update).toHaveBeenCalledTimes(2);
      const lockCall = prisma.user.update.mock.calls[1][0] as {
        data: Record<string, unknown>;
      };
      expect(lockCall.data).toHaveProperty('lockedUntil');
    });

    it('rejects login when account is locked', async () => {
      const user = buildUserWithRoles(['CLIENT'], {
        email: dto.email,
        emailVerified: true,
        lockedUntil: new Date(Date.now() + 900_000), // locked for 15min
      });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.login(dto)).rejects.toThrow();
      expect(comparePassword).not.toHaveBeenCalled();
    });

    it('returns grace period response for self-deleted user within the window', async () => {
      const user = buildUserWithRoles(['CLIENT'], {
        email: dto.email,
        emailVerified: true,
        isActive: false,
        deletedAt: new Date(Date.now() - 5 * 86_400_000), // deleted 5 days ago
        deactivatedBy: null,
      });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.login(dto);
      expect(result).toHaveProperty('requiresReactivation', true);
      expect(result).toHaveProperty('daysRemaining');
    });

    it('throws for admin blocked users', async () => {
      const user = buildUserWithRoles(['CLIENT'], {
        email: dto.email,
        emailVerified: true,
        isActive: false,
        deletedAt: null,
        deactivatedBy: 'admin-1',
      });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.login(dto)).rejects.toThrow();
    });
  });

  // ----- REFRESH TOKENS ----- //

  describe('refreshTokens', () => {
    it('rotates refresh token and issues new pair', async () => {
      const stored = buildRefreshToken();
      prisma.refreshToken.findFirst.mockResolvedValue(stored);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshTokens('valid-refresh');

      // Old token revoked
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: stored.id },
          data: { revokedAt: expect.any(Date) },
        }),
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('throws on invalid/expired refresh token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('expired');
      });

      await expect(service.refreshTokens('bad-token')).rejects.toThrow();
    });

    it('throws when stored token is revoked', async () => {
      const stored = buildRefreshToken({ revokedAt: new Date() });
      prisma.refreshToken.findFirst.mockResolvedValue(stored);

      await expect(service.refreshTokens('valid-jwt')).rejects.toThrow();
    });
  });

  // ----- REFRESH TOKENS ----- //

  describe('logout', () => {
    it('revokes the refresh token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('some-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });
  });

  // ----- VERIFY EMAIL ----- //

  describe('verifyEmail', () => {
    it('sets emailVerified = true and marks token as used', async () => {
      const token = buildVerificationToken({
        type: VerificationTokenType.EMAIL_VERIFICATION,
      });
      prisma.verificationToken.findUnique.mockResolvedValue(token);

      const result = await service.verifyEmail({ token: token.token });

      expect(result).toHaveProperty('message');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('rejects already-used token', async () => {
      const token = buildVerificationToken({ usedAt: new Date() });
      prisma.verificationToken.findUnique.mockResolvedValue(token);

      await expect(service.verifyEmail({ token: token.token })).rejects.toThrow();
    });

    it('rejects expired token', async () => {
      const token = buildVerificationToken({
        expiresAt: new Date(Date.now() - 1000),
      });
      prisma.verificationToken.findUnique.mockResolvedValue(token);

      await expect(service.verifyEmail({ token: token.token })).rejects.toThrow();
    });
  });

  // ----- FORGOT / RESET PASSWORD ----- //

  describe('forgotPassword', () => {
    it('sends reset email for valid active user', async () => {
      const user = buildUser({ isActive: true });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.verificationToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.verificationToken.create.mockResolvedValue({});

      await service.forgotPassword({ email: user.email });

      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'passwordReset' }),
      );
    });

    it('does not leak info for non-existent email (returns silently)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      // Should not throw
      await service.forgotPassword({ email: 'missing@test.com' });
      expect(email.send).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('updates password, revokes all sessions, sends confirmation email', async () => {
      const token = buildVerificationToken({
        type: VerificationTokenType.PASSWORD_RESET,
        user: {
          id: 'u1',
          email: 'test@kambriq.com',
          firstName: 'Alice',
          preferredLanguage: 'fr',
        },
      });
      prisma.verificationToken.findUnique.mockResolvedValue(token);

      const result = await service.resetPassword({
        token: token.token,
        newPassword: 'NewStr0ng!Pass',
      });

      expect(result).toHaveProperty('message');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'passwordResetConfirmation' }),
      );
    });
  });

  // ----- REACTIVATE ACCOUNT ----- //

  describe('reactivateAccount', () => {
    const dto = { email: 'test@kambriq.com', password: 'Pass1!word' };

    it('reactivates a self-deleted account within grace period', async () => {
      const user = buildUserWithRoles(['CLIENT'], {
        email: dto.email,
        isActive: false,
        deletedAt: new Date(Date.now() - 5 * 86_400_000), // 5 days ago
        deactivatedBy: null,
      });
      prisma.user.findUnique.mockResolvedValue(user);
      (comparePassword as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.reactivateAccount(dto);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true, deletedAt: null }),
        }),
      );
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'accountReactivated' }),
      );
      expect(result).toHaveProperty('tokens');
    });

    it('rejects admin-blocked accounts', async () => {
      const user = buildUser({
        email: dto.email,
        isActive: false,
        deactivatedBy: 'admin-1',
      });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.reactivateAccount(dto)).rejects.toThrow();
    });

    it('rejects wrong password', async () => {
      const user = buildUser({
        email: dto.email,
        isActive: false,
        deletedAt: new Date(),
        deactivatedBy: null,
      });
      prisma.user.findUnique.mockResolvedValue(user);
      (comparePassword as jest.Mock).mockResolvedValue(false);

      await expect(service.reactivateAccount(dto)).rejects.toThrow();
    });
  });
});
