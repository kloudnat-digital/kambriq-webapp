import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from '../../../../core/auth/strategies/jwt.strategy';
import {
  mockConfigService,
  mockCorePrisma,
  mockI18n,
  resetIdCounter,
} from '../../../utils';
import { CorePrismaService } from '../../../../core/prisma/core-prisma.service';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: ReturnType<typeof mockCorePrisma>;

  beforeEach(async () => {
    resetIdCounter();
    prisma = mockCorePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: CorePrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: I18nService, useValue: mockI18n() },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  const basePayload = {
    sub: 'user-1',
    email: 'test@kambriq.com',
    roles: ['CLIENT'],
    lang: 'fr',
  };

  it('throws UnauthorizedException if user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(basePayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws for admin-suspended accounts', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kambriq.com',
      isActive: false,
      deactivatedBy: 'admin-1',
      deletedAt: null,
      lockedUntil: null,
      preferredLanguage: 'en',
      userRoles: [],
    });

    await expect(strategy.validate(basePayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws for self-deleted accounts', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kambriq.com',
      isActive: false,
      deactivatedBy: null,
      deletedAt: new Date(),
      lockedUntil: null,
      preferredLanguage: 'fr',
      userRoles: [],
    });

    await expect(strategy.validate(basePayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws for locked accounts', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kambriq.com',
      isActive: true,
      deactivatedBy: null,
      deletedAt: null,
      lockedUntil: new Date(Date.now() + 600_000), // locked 10min
      preferredLanguage: 'fr',
      userRoles: [],
    });

    await expect(strategy.validate(basePayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('uses preferred language from DB (not from JWT payload)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kambriq.com',
      isActive: true,
      deactivatedBy: null,
      deletedAt: null,
      lockedUntil: null,
      preferredLanguage: 'en',
      userRoles: [{ role: { code: 'CLIENT' } }],
    });

    const result = await strategy.validate({ ...basePayload, lang: 'fr' });
    expect(result.lang).toBe('en');
  });
});
