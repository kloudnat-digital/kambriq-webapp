import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { StringValue } from 'ms';

import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '@kambriq/core/user';
import { GlobalRole, Prisma } from '@kambriq/shared';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { ProfileService } from '@kambriq/core/profile';

@Injectable()
export class AuthService {
  private readonly bcryptSaltRounds: number;

  constructor(
    private jwt: JwtService,
    private users: UserService,
    private profileService: ProfileService,
    private config: ConfigService,
  ) {
    const rounds = Number(config.get<number>('BCRYPT_SALT_ROUNDS') ?? 12);
    const isValidRounds =
      Number.isInteger(rounds) && rounds >= 8 && rounds <= 16;

    if (!isValidRounds) {
      throw new Error(
        'Invalid BCRYPT_SALT_ROUNDS value. Provide an integer between 8 and 16.',
      );
    }

    this.bcryptSaltRounds = rounds;
  }

  async signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.users.findUserByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      this.bcryptSaltRounds,
    );

    try {
      const user = await this.users.createUser({
        email,
        password: hashedPassword,
        roleName: GlobalRole.CLIENT,
      });

      await this.profileService.createProfile(user.id, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        country: dto.country,
        locale: dto.locale,
        phone: dto.phone,
      });

      return this.signToken(user.id, user.email);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }

      throw new InternalServerErrorException('Could not create user.');
    }
  }

  async signin(dto: SigninDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.users.findUserByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.signToken(user.id, user.email);
  }

  async signToken(
    userId: string,
    email: string,
  ): Promise<{ access_token: string }> {
    const payload = { sub: userId, email };
    const token = await this.jwt.signAsync(payload, {
      expiresIn: this.config.get<StringValue>('JWT_EXPIRES_IN') ?? '15m',
    });
    return {
      access_token: token,
    };
  }
}
