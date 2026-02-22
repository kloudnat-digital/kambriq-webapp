import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StringValue } from 'ms';
import crypto from 'crypto';
import { CorePrismaService } from '../prisma/core-prisma.service';
import {
  AccountReactivationDto,
  AuthResponse,
  EmailVerificationDto,
  ForgotPasswordDto,
  GracePeriodResponse,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TokenResponse,
} from './dto/auth.dto';
import {
  comparePassword,
  EMAIL_TOKEN_EXPIRY_HOURS,
  EmailAlreadyExistsException,
  EmailService,
  GRACE_PERIOD_DAYS,
  hashPassword,
  InvalidCredentialsException,
  InvalidRefreshTokenException,
  JwtPayload,
  LOCK_DURATION_MINUTES,
  MAX_LOGIN_ATTEMPTS,
  RESET_TOKEN_EXPIRY_HOURS,
  RoleCode,
  VerificationTokenType,
} from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: CorePrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly i18n: I18nService,
  ) {
    this.frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3001',
    );
  }

  // ----- Register ------------------------------------------
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const lang = dto.language || 'fr';

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new EmailAlreadyExistsException(this.t('auth.emailExists', lang));
    }

    const passwordHash = await hashPassword(dto.password);

    // Create user with default 'client' role
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        preferredLanguage: lang,
      },
    });

    // Assign default 'client' role
    const clientRole = await this.prisma.role.findUnique({
      where: { code: RoleCode.CLIENT },
    });
    if (clientRole) {
      await this.prisma.userRole.create({
        data: { userId: user.id, roleId: clientRole.id },
      });
    }

    // Send verification email
    const verificationToken = this.createVerificationToken(
      user.id,
      VerificationTokenType.EMAIL_VERIFICATION,
    );
    const verificationUrl = `${this.frontendUrl}/verify-email?token=${verificationToken}`;
    await this.emailService.send({
      to: user.email,
      template: 'verification',
      lang,
      args: {
        firstName: user.firstName,
        verificationUrl,
      },
    });

    const roles = clientRole ? [RoleCode.CLIENT] : [];
    const tokens = await this.generateTokens(user.id, user.email, roles, lang);

    this.logger.log('User registered', { userId: user.id, lang });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        language: lang,
      },
      tokens,
    };
  }

  // ----- Login ------------------------------------------
  async login(dto: LoginDto): Promise<AuthResponse | GracePeriodResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { userRoles: { include: { role: true } } },
    });

    const lang = user?.preferredLanguage || 'fr';

    if (!user) {
      throw new InvalidCredentialsException(
        this.t('auth.login.invalidCredentials', lang),
      );
    }

    if (!user.isActive) {
      if (
        user.deletedAt &&
        !user.deactivatedBy &&
        this.isWithenGracePeriod(user.deletedAt)
      ) {
        const daysRemaining = Math.ceil(
          (GRACE_PERIOD_DAYS * 86_400_000 -
            (Date.now() - user.deletedAt.getTime())) /
            86_400_000,
        );
        this.logger.log('Inactive user within grace period attempted login', {
          userId: user.id,
          daysRemaining,
        });

        return {
          requiresReactivation: true,
          userId: user.id,
          daysRemaining,
          message: this.t('auth.login.gracePeriodDays', lang, {
            days: daysRemaining,
          }),
        };
      }

      throw new InvalidCredentialsException(
        this.t('auth.login.inactiveAccount', lang),
      );
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60_000,
      );
      throw new UnauthorizedException(
        this.t('auth.login.accountLocked', lang, { minutes: minutesLeft }),
      );
    }

    const isPasswordValid = await comparePassword(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      const attempts = user.loginAttempts + 1;
      await this.handleFailedLogin({
        attempts,
        userId: user.id,
      });

      const remaining = MAX_LOGIN_ATTEMPTS - attempts;

      if (remaining > 0) {
        throw new UnauthorizedException(
          this.t('auth.login.attemptsRemaining', lang, { remaining }),
        );
      }

      throw new UnauthorizedException(
        this.t('auth.login.lockedAfterAttempts', lang, {
          minutes: LOCK_DURATION_MINUTES,
        }),
      );
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const tokens = await this.generateTokens(user.id, user.email, roles, lang);

    this.logger.log('User logged in', { userId: user.id });

    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: roles,
        language: lang,
      },
    };
  }

  // ----- Refresh Token ------------------------------------------
  async refreshTokens(refreshToken: string): Promise<TokenResponse> {
    try {
      this.jwtService.verify(refreshToken);
    } catch {
      throw new InvalidRefreshTokenException(
        this.t('auth.token.invalidRefresh'),
      );
    }

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { token: this.hashToken(refreshToken) },
      include: {
        user: { include: { userRoles: { include: { role: true } } } },
      },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt < new Date()
    ) {
      throw new InvalidRefreshTokenException(
        this.t('auth.token.invalidRefresh'),
      );
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    if (!storedToken.user || !storedToken.user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    const roles = storedToken.user.userRoles.map((ur) => ur.role.code);
    const tokens = await this.generateTokens(
      storedToken.user.id,
      storedToken.user.email,
      roles,
      storedToken.user.preferredLanguage || 'fr',
    );

    this.logger.log('Token refreshed', { userId: storedToken.user.id });

    return tokens;
  }

  // ----- Logout ------------------------------------------
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { token: tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.log('User logged out', { refreshTokenHash: tokenHash });
  }

  // ----- Verify Email ------------------------------------------
  async verifyEmail(dto: EmailVerificationDto): Promise<{ message: string }> {
    const tokenRecord = await this.prisma.verificationToken.findUnique({
      where: { token: dto.token },
      include: { user: { select: { preferredLanguage: true } } },
    });

    const lang = tokenRecord?.user?.preferredLanguage || 'fr';

    if (
      !tokenRecord ||
      tokenRecord.type !== VerificationTokenType.EMAIL_VERIFICATION
    ) {
      throw new BadRequestException(this.t('auth.email.invalidToken', lang));
    }
    if (tokenRecord.usedAt) {
      throw new BadRequestException(this.t('auth.email.tokenUsed', lang));
    }
    if (tokenRecord.expiresAt < new Date()) {
      throw new BadRequestException(this.t('auth.email.tokenExpired', lang));
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: tokenRecord.userId },
        data: { emailVerified: true },
      }),
      this.prisma.verificationToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    this.logger.log('Email verified', { userId: tokenRecord.userId });
    return { message: this.t('auth.email.verified', lang) };
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const lang = user?.preferredLanguage || 'fr';

    if (!user) {
      return { message: this.t('auth.email.verificationSent', lang) };
    }
    if (user.emailVerified) {
      return { message: this.t('auth.email.alreadyVerified', lang) };
    }

    const token = await this.createVerificationToken(
      user.id,
      VerificationTokenType.EMAIL_VERIFICATION,
    );
    const verificationUrl = `${this.frontendUrl}/verify-email?token=${token}`;

    await this.emailService.send({
      to: user.email,
      template: 'verification',
      lang,
      args: {
        firstName: user.firstName,
        verificationUrl,
      },
    });

    this.logger.log('Verification email resent', {
      userId: user.id,
      email: user.email,
    });
    return { message: this.t('auth.email.verificationSent', lang) };
  }

  // ----- Forgot / Reset Password ------------------------------------------
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const lang = user?.preferredLanguage || 'fr';

    if (user && user.isActive) {
      const token = await this.createVerificationToken(
        user.id,
        VerificationTokenType.PASSWORD_RESET,
      );
      const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;

      await this.emailService.send({
        to: user.email,
        template: 'passwordReset',
        lang,
        args: {
          firstName: user.firstName,
          resetUrl,
        },
      });

      this.logger.log('Password reset email sent', {
        userId: user.id,
        email: user.email,
      });
      return { message: this.t('auth.password.resetSent', lang) };
    }
  }
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const { token, newPassword } = dto;
    const tokenRecord = await this.prisma.verificationToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            preferredLanguage: true,
          },
        },
      },
    });

    const lang = tokenRecord?.user?.preferredLanguage || 'fr';

    if (
      !tokenRecord ||
      tokenRecord.type !== VerificationTokenType.PASSWORD_RESET
    ) {
      throw new BadRequestException(
        this.t('auth.password.invalidResetToken', lang),
      );
    }
    if (tokenRecord.usedAt) {
      throw new BadRequestException(this.t('auth.email.tokenUsed', lang));
    }
    if (tokenRecord.expiresAt < new Date()) {
      throw new BadRequestException(this.t('auth.email.tokenExpired', lang));
    }

    const passwordHash = await hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: tokenRecord.userId },
        data: { passwordHash, loginAttempts: 0, lockedUntil: null },
      }),
      this.prisma.verificationToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: tokenRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    if (tokenRecord.user) {
      await this.emailService.send({
        to: tokenRecord.user.email,
        template: 'passwordResetConfirmation',
        lang,
        args: {
          firstName: tokenRecord.user.firstName,
        },
      });
    }

    this.logger.log('Password reset successful', {
      userId: tokenRecord.userId,
    });
    return { message: this.t('auth.password.resetSuccess', lang) };
  }

  // ----- Account Reactivation ------------------------------------------
  async reactivateAccount(dto: AccountReactivationDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { userRoles: { include: { role: true } } },
    });

    const lang = user?.preferredLanguage || 'fr';

    if (!user) {
      throw new NotFoundException(
        this.t('auth.login.invalidCredentials', lang),
      );
    }
    if (!user.deletedAt || user.deactivatedBy) {
      throw new BadRequestException(
        this.t('auth.reactivation.notEligible', lang),
      );
    }
    if (!this.isWithenGracePeriod(user.deletedAt)) {
      throw new BadRequestException(
        this.t('auth.reactivation.gracePeriodExpired', lang),
      );
    }

    const isPasswordValid = await comparePassword(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new BadRequestException(
        this.t('auth.login.invalidCredentials', lang),
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: true,
        deletedAt: null,
        deactivatedBy: null,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    const roles = user.userRoles.map((ur) => ur.role.code);
    const tokens = await this.generateTokens(user.id, user.email, roles, lang);

    await this.emailService.send({
      to: user.email,
      template: 'accountReactivated',
      lang,
      args: {
        firstName: user.firstName,
      },
    });

    this.logger.log('Account reactivated', { userId: user.id });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        language: lang,
      },
      tokens,
    };
  }

  // ----- Private Helpers ------------------------------------------
  private async generateTokens(
    userId: string,
    email: string,
    roles: string[],
    lang: string,
  ): Promise<TokenResponse> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      roles,
      lang,
    };

    const accessExpiration = this.config.get<StringValue>(
      'JWT_ACCESS_EXPIRATION',
      '15m',
    );
    const refreshExpiration = this.config.get<StringValue>(
      'JWT_REFRESH_EXPIRATION',
      '15d',
    );

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessExpiration,
    });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: refreshExpiration,
    });

    const expiresAt = new Date(
      Date.now() + this.parseExpiry(refreshExpiration),
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresAt,
    };
  }

  private async handleFailedLogin(data: { attempts: number; userId: string }) {
    await this.prisma.user.update({
      where: { id: data.userId },
      data: {
        loginAttempts: { increment: 1 },
      },
    });

    if (data.attempts >= MAX_LOGIN_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60_000);
      await this.prisma.user.update({
        where: { id: data.userId },
        data: {
          lockedUntil: lockUntil,
        },
      });
      this.logger.warn(`Account locked due to too many failed attempts`, {
        userId: data.userId,
        lockUntil: LOCK_DURATION_MINUTES,
      });
    }
  }

  private async createVerificationToken(
    userId: string,
    type: VerificationTokenType,
  ): Promise<string> {
    await this.prisma.verificationToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    });

    const expiryHours =
      type === VerificationTokenType.PASSWORD_RESET
        ? RESET_TOKEN_EXPIRY_HOURS
        : EMAIL_TOKEN_EXPIRY_HOURS;
    const token = crypto.randomBytes(32).toString('hex');

    await this.prisma.verificationToken.create({
      data: {
        userId,
        token,
        type,
        expiresAt: new Date(Date.now() + expiryHours * 3_600_000),
      },
    });

    return token;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseExpiry(expiry: StringValue): number {
    const units: Record<string, number> = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };

    const match = expiry.match(/^(\d+)([smhd])$/);

    if (!match) return 15 * 864_000_000;

    return parseInt(match[1], 10) * (units[match[2]] || 86_400_000);
  }

  private isWithenGracePeriod(deletedAt: Date | null): boolean {
    if (!deletedAt) return false;
    const daysSinceDeletion =
      (Date.now() - deletedAt.getTime()) / (100 * 60 * 60 * 24);
    return daysSinceDeletion <= GRACE_PERIOD_DAYS;
  }

  private t(key: string, lang = 'fr', args?: Record<string, unknown>): string {
    return this.i18n.translate(key, { lang, args });
  }
}
