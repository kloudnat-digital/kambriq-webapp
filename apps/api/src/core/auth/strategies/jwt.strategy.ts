import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CorePrismaService } from '../../prisma/core-prisma.service';
import { JwtPayload, RequestUser } from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';
import { assertHoldsSession, SESSION_STANDING_SELECT } from '../session-standing';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly i18n: I18nService,
    private readonly prisma: CorePrismaService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET is not defined in environment variables');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const lang = payload.lang || 'fr';

    // Validate the token type to prevent refresh tokens from being used as access tokens.
    if (payload.type !== 'access') {
      throw new UnauthorizedException(this.t('auth.jwt.invalidTokenType', lang));
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        ...SESSION_STANDING_SELECT,
        preferredLanguage: true,
        userRoles: { include: { role: { select: { code: true } } } },
      },
    });

    if (!user) {
      throw new UnauthorizedException(this.t('auth.jwt.userNotFound', lang));
    }

    const userLang = user.preferredLanguage || lang;
    assertHoldsSession(user, (key) => this.t(key, userLang));

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
