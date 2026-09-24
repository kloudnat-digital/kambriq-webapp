import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { I18nService } from 'nestjs-i18n';
import { AuthService } from './auth.service';
import { DEFAULT_LANGUAGE, Public } from '@kambriq/common';
import {
  AccountReactivationDto,
  EmailVerificationDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResendVerificationEmailDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Returns the token fields that go in the response body.
   *
   * refreshToken IS included here because this endpoint is called server-to-server
   * from next-auth's authorize() and jwt() callbacks - never from browser JS.
   * next-auth encrypts it immediately into its own httpOnly session cookie.
   *
   * rememberMe is internal only and is always stripped.
   */
  private publicTokens(tokens: {
    accessToken: string;
    refreshToken: string;
    accessExpiresAt: Date;
  }) {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessExpiresAt: tokens.accessExpiresAt,
    };
  }

  // ----- Endpoints ---------------------------------------------

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({
    status: 201,
    description: 'Account created. Returns user profile and access token.',
  })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return { ...result, tokens: this.publicTokens(result.tokens) };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful. Returns user profile and tokens.',
  })
  @ApiResponse({ status: 400, description: 'Invalid credentials.' })
  @ApiResponse({ status: 401, description: 'Account locked, suspended, or email not verified.' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);

    // GracePeriodResponse - account soft-deleted, return as-is (no tokens)
    if ('requiresReactivation' in result) return result;

    return { ...result, tokens: this.publicTokens(result.tokens) };
  }

  // A41. Peak measured per caller: 15 a minute (NextAuth bursts). Double it -
  // a limit too low here logs people out in the middle of a session.
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate tokens using the refresh token in the body',
    description:
      'Revokes the presented refresh token and issues a new pair. Called server-to-server ' +
      'from next-auth jwt() callback.',
  })
  @ApiResponse({ status: 200, description: 'Returns new access and refresh tokens.' })
  @ApiResponse({ status: 400, description: 'Refresh token missing, invalid, or expired.' })
  async refresh(@Body() body?: { refreshToken?: string }) {
    if (!body?.refreshToken) {
      throw new BadRequestException(
        this.i18n.translate('auth.token.missingRefresh', { lang: DEFAULT_LANGUAGE }),
      );
    }

    const tokens = await this.authService.refreshTokens(body.refreshToken);
    return this.publicTokens(tokens);
  }

  // A41. One call per sign-out, none in the 7 days measured. House auth value.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Logout and revoke the refresh token',
    description:
      'Revokes the refresh token in the database. Safe to call even if no token is provided.',
  })
  @ApiResponse({ status: 204, description: 'Logged out.' })
  async logout(@Body() body?: { refreshToken?: string }) {
    if (body?.refreshToken) {
      await this.authService.logout(body.refreshToken);
    }
  }

  // A41. Peak measured per caller: 3 (a journeys run). A double click is 2.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address with a one-time token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully.' })
  @ApiResponse({ status: 400, description: 'Token invalid, already used, or expired.' })
  async verifyEmail(@Body() dto: EmailVerificationDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend the email verification link' })
  @ApiResponse({ status: 200, description: 'If unverified, a new link has been sent.' })
  async resendVerificationEmail(@Body() dto: ResendVerificationEmailDto) {
    return this.authService.resendVerificationEmail(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiResponse({ status: 204, description: 'If account exists, reset email sent.' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
  }

  // A41. Peak measured per caller: 3 (journey 5). The token cannot be guessed;
  // this bounds abuse, not brute force.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset password using a one-time token' })
  @ApiResponse({ status: 204, description: 'Password updated. All sessions revoked.' })
  @ApiResponse({ status: 400, description: 'Token invalid, expired, or already used.' })
  async changePassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
  }

  // A41. It checks a password, like login, and was not called in the 7 days
  // measured. Five tries a minute, as for forgot-password.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a soft-deleted account within the grace period' })
  @ApiResponse({
    status: 200,
    description: 'Account reactivated. Returns user profile and access token.',
  })
  @ApiResponse({ status: 400, description: 'Invalid credentials or grace period expired.' })
  async reactivateAccount(@Body() dto: AccountReactivationDto) {
    const result = await this.authService.reactivateAccount(dto);
    return { ...result, tokens: this.publicTokens(result.tokens) };
  }
}
