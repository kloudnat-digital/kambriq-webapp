import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CorePrismaService } from '../../prisma/core-prisma.service';
import { JwtPayload, RequestUser } from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly i18n: I18nService,
    private readonly prisma: CorePrismaService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret)
      throw new Error('JWT_SECRET is not defined in environment variables');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const lang = payload.lang || 'fr';
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        isActive: true,
        deletedAt: true,
        deactivatedBy: true,
        lockedUntil: true,
        preferredLanguage: true,
        userRoles: { include: { role: { select: { code: true } } } },
      },
    });

    if (!user) {
      throw new UnauthorizedException(this.t('auth.jwt.userNotFound', lang));
    }

    const userLang = user.preferredLanguage || lang;

    // Account deactivated by admin
    if (!user.isActive && user.deactivatedBy) {
      throw new UnauthorizedException(
        this.t('auth.jwt.accountSuspended', userLang),
      );
    }

    // Account self-deleted
    if (!user.isActive && user.deletedAt) {
      throw new UnauthorizedException(
        this.t('auth.jwt.accountDeleted', userLang),
      );
    }

    // Generic inactive
    if (!user.isActive) {
      throw new UnauthorizedException(
        this.t('auth.jwt.accountInactive', userLang),
      );
    }

    // Account locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        this.t('auth.jwt.accountLocked', userLang),
      );
    }

    return {
      id: user.id,
      email: user.email,
      roles: user.userRoles.map((ur) => ur.role.code),
      lang: userLang,
    };
  }

  private t(key: string, lang: string): string {
    return this.i18n.translate(key, { lang });
  }
}
