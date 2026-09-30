import { createHash } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { JwtService } from '@nestjs/jwt';
import {
  EmailService,
  issueVerificationToken,
  RoleCode,
  StorageService,
  VerificationTokenType,
} from '@kambriq/common';
import { AuthService } from '../../../core/auth/auth.service';
import { UsersService } from '../../../core/users/users.service';
import { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import {
  mockConfigService,
  mockCorePrisma,
  mockEmailService,
  mockI18n,
  mockJwtService,
  mockStorageService,
} from '../../utils';

jest.mock('@kambriq/common', () => {
  const actual = jest.requireActual('@kambriq/common');
  return {
    ...actual,
    hashPassword: jest.fn().mockResolvedValue('$2b$10$hashed'),
    comparePassword: jest.fn().mockResolvedValue(true),
  };
});

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

type Row = {
  id: string;
  userId: string;
  token: string;
  type: string;
  expiresAt: Date;
  usedAt: Date | null;
};

/**
 * C27 - a verification, reset or email-change token is stored as its SHA-256
 * digest, never as the value the link carries, so a read of the table yields
 * nothing usable. The store below answers only an exact match on the stored
 * column, as the unique index does: issuing and looking up must agree.
 */
describe('C27 - verification tokens are stored as digests', () => {
  let prisma: ReturnType<typeof mockCorePrisma>;
  let email: ReturnType<typeof mockEmailService>;
  let auth: AuthService;
  let users: UsersService;
  let rows: Row[];

  const user = {
    id: 'user-1',
    email: 'ada@example.com',
    firstName: 'Ada',
    preferredLanguage: 'fr',
    passwordHash: '$2b$10$old',
    pendingEmail: 'ada.new@example.com',
    isActive: true,
  };

  beforeEach(async () => {
    rows = [];
    prisma = mockCorePrisma();
    email = mockEmailService();
    prisma.verificationToken.create.mockImplementation(async ({ data }: { data: Row }) => {
      const row = { id: `t${rows.length}`, usedAt: null, ...data };
      rows.push(row);
      return row;
    });
    prisma.verificationToken.updateMany.mockResolvedValue({ count: 0 });
    prisma.verificationToken.findUnique.mockImplementation(
      async ({ where }: { where: { token: string } }) => {
        const row = rows.find((r) => r.token === where.token);
        return row ? { ...row, user } : null;
      },
    );
    prisma.$transaction = jest.fn(async (ops: unknown) =>
      Array.isArray(ops) ? Promise.all(ops) : ops,
    ) as never;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UsersService,
        { provide: CorePrismaService, useValue: prisma },
        { provide: JwtService, useValue: mockJwtService() },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: EmailService, useValue: email },
        { provide: I18nService, useValue: mockI18n() },
        { provide: StorageService, useValue: mockStorageService() },
      ],
    }).compile();
    auth = module.get(AuthService);
    users = module.get(UsersService);
  });

  describe('issued through issueVerificationToken (verification, reset, bootstrap)', () => {
    it('stores the digest of the value it returns, never the value', async () => {
      const sent = await issueVerificationToken(
        prisma as never,
        user.id,
        VerificationTokenType.EMAIL_VERIFICATION,
      );
      expect(sent).toMatch(/^[0-9a-f]{64}$/);
      expect(rows[0].token).not.toBe(sent);
      expect(rows[0].token).toBe(sha256(sent));
    });

    it('verifies an email with the value the link carries', async () => {
      const sent = await issueVerificationToken(
        prisma as never,
        user.id,
        VerificationTokenType.EMAIL_VERIFICATION,
      );
      await expect(auth.verifyEmail({ token: sent })).resolves.toHaveProperty('message');
    });

    it('refuses a value that was never issued', async () => {
      await issueVerificationToken(
        prisma as never,
        user.id,
        VerificationTokenType.EMAIL_VERIFICATION,
      );
      await expect(auth.verifyEmail({ token: 'f'.repeat(64) })).rejects.toThrow();
    });

    it('refuses the stored digest itself, as a link value', async () => {
      await issueVerificationToken(prisma as never, user.id, VerificationTokenType.PASSWORD_RESET);
      await expect(
        auth.resetPassword({ token: rows[0].token, newPassword: 'Aa1!aaaaaa' }),
      ).rejects.toThrow();
    });

    it('resets a password with the value the link carries', async () => {
      const sent = await issueVerificationToken(
        prisma as never,
        user.id,
        VerificationTokenType.PASSWORD_RESET,
      );
      await expect(
        auth.resetPassword({ token: sent, newPassword: 'Aa1!aaaaaa' }),
      ).resolves.toHaveProperty('message');
    });
  });

  describe('the invitation of a client created by a reservation', () => {
    it('stores the digest and emails the value', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-client', code: RoleCode.CLIENT });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-2', email: 'new@example.com' });

      await users.findOrCreateClientUser('new@example.com', 'New', 'Client');

      const link = email.send.mock.calls[0][0].args.setPasswordUrl as string;
      const sent = new URL(link).searchParams.get('token') as string;
      expect(rows[0].token).not.toBe(sent);
      expect(rows[0].token).toBe(sha256(sent));
    });
  });

  describe('an email change', () => {
    it('stores the digest, emails the value, and confirms with the value', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(user) // requestEmailChange: the account
        .mockResolvedValueOnce(null) // the new address is free
        .mockResolvedValueOnce(user) // confirmEmailChange: the pending address
        .mockResolvedValueOnce(null); // still free
      await users.requestEmailChange(user.id, {
        newEmail: 'ada.new@example.com',
        currentPassword: 'x',
      });

      const link = email.send.mock.calls[0][0].args.confirmUrl as string;
      const sent = new URL(link).searchParams.get('token') as string;
      expect(rows[0].token).not.toBe(sent);
      expect(rows[0].token).toBe(sha256(sent));

      await expect(users.confirmEmailChange(user.id, { token: sent })).resolves.toHaveProperty(
        'message',
      );
    });
  });
});
