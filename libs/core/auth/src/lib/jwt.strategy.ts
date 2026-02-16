import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '@kambriq/core/user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private users: UserService,
  ) {
    const secret = config.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('JWT_SECRET is not defined in the configuration.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; email: string }) {
    console.log('Validating JWT payload:', payload);
    const user = await this.users.findUserWithRolesById(payload.sub);

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException();
    }

    return {
      userId: user.id,
      email: user.email,
      roles: user.roles.map(
        ({ role }: { role: { name: string } }) => role.name,
      ),
      status: user.status,
    };
  }
}
