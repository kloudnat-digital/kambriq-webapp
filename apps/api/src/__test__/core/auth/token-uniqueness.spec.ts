import { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { EmailService } from '@kambriq/common';
import type { I18nService } from 'nestjs-i18n';
import { AuthService } from '../../../core/auth/auth.service';
import type { CorePrismaService } from '../../../core/prisma/core-prisma.service';

/**
 * A47 - two tokens issued in the same second are two different tokens.
 *
 * Measured on dev: a refresh made in the same second as the login that issued
 * its token answered 409 "A record with this field already exists", and the
 * web's own bursts produced the same 409. The JWT carried only the user's
 * claims, `iat` and `exp` - all identical within one second - so the new
 * refresh token was byte-for-byte the old one, and its hash hit the unique
 * index. The real `JwtService` is used here: a mocked one returns whatever it
 * is told and cannot collide.
 */
describe('A47 - token uniqueness', () => {
  const create = jest.fn().mockResolvedValue({});
  const service = new AuthService(
    { refreshToken: { create } } as unknown as CorePrismaService,
    new JwtService({ secret: 'a47-test-secret' }),
    { get: (_k: string, fallback?: unknown) => fallback } as unknown as ConfigService,
    {} as EmailService,
    { translate: (k: string) => k } as unknown as I18nService,
  );

  /** `generateTokens` is private; it is the one place tokens are minted. */
  const issue = () =>
    (
      service as unknown as {
        generateTokens: (
          id: string,
          email: string,
          roles: string[],
          lang: string,
        ) => Promise<{ accessToken: string; refreshToken: string }>;
      }
    ).generateTokens('u1', 'u1@example.test', ['CLIENT'], 'fr');

  beforeEach(() => {
    create.mockClear();
    jest.useFakeTimers({ now: new Date('2026-09-25T04:30:00.200Z') });
  });
  afterEach(() => jest.useRealTimers());

  it('issues two different refresh tokens for the same user in the same second', async () => {
    const first = await issue();
    const second = await issue();

    expect(second.refreshToken).not.toBe(first.refreshToken);
    const stored = create.mock.calls.map(([arg]) => arg.data.token);
    expect(stored[1]).not.toBe(stored[0]);
  });

  it('issues two different access tokens for the same user in the same second', async () => {
    const first = await issue();
    const second = await issue();
    expect(second.accessToken).not.toBe(first.accessToken);
  });
});
