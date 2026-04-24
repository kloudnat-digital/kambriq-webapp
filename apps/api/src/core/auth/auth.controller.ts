import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
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

// The name of the httpOnly cookie that carries the refresh token.
// Scoped to /api/auth so the browser only sends it to auth endpoints,
// never to /api/lands, /api/users, etc.
const REFRESH_COOKIE = 'kambriq_rt';
const COOKIE_PATH = '/api/auth';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly i18n: I18nService,
  ) {}

  // ----- Cookie helpers ----------------------------------------

  /**
   * Sets the refresh token as an httpOnly cookie.
   *
   * httpOnly  → JavaScript cannot read it (XSS-safe)
   * secure    → only sent over HTTPS in production
   * sameSite  → only sent on same-site requests (CSRF-safe)
   * path      → scoped to /api/auth, not sent to other API routes
   * maxAge    → only set when rememberMe=true; otherwise it's a session cookie
   *             (browser deletes it automatically when the window is closed)
   */
  private setRefreshCookie(res: Response, token: string, rememberMe: boolean): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: COOKIE_PATH,
      ...(rememberMe ? { maxAge: 30 * 24 * 60 * 60 * 1000 } : {}), // 30 days in ms
    });
  }

  /**
   * Returns the token fields that go in the response body.
   *
   * refreshToken IS included here because this endpoint is called server-to-server
   * from next-auth's authorize() and jwt() callbacks - never from browser JS.
   * next-auth encrypts it immediately into its own httpOnly session cookie.
   *
   * rememberMe is internal only and is always stripped.
   */
  private publicTokens(tokens: { accessToken: string; refreshToken: string; expiresAt: Date }) {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    };
  }

  /**
   * Clears the refresh token cookie.
   * Must pass the exact same options as setRefreshCookie so the browser
   * knows which cookie to delete.
   */
  private clearRefreshCookie(res: Response): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: COOKIE_PATH,
    });
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
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);

    // Set refresh token in httpOnly cookie (session, no rememberMe on register)
    this.setRefreshCookie(res, result.tokens.refreshToken, false);

    // Strip refreshToken and rememberMe from the response body -
    // the client only needs the accessToken and expiresAt
    return { ...result, tokens: this.publicTokens(result.tokens) };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({
    status: 200,
    description:
      'Authentication successful. Returns user profile and access token. Refresh token set as httpOnly cookie.',
  })
  @ApiResponse({ status: 400, description: 'Invalid credentials.' })
  @ApiResponse({ status: 401, description: 'Account locked, suspended, or email not verified.' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);

    // GracePeriodResponse - account soft-deleted, return as-is (no tokens)
    if ('requiresReactivation' in result) return result;

    this.setRefreshCookie(res, result.tokens.refreshToken, dto.rememberMe ?? false);

    return { ...result, tokens: this.publicTokens(result.tokens) };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate tokens using the httpOnly refresh cookie',
    description:
      'Reads the refresh token from the httpOnly cookie (not the request body). ' +
      'Revokes the old token, issues a new access token, and rotates the cookie. ' +
      'The new cookie preserves the original "remember me" duration.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns new access token. Rotates the refresh cookie.',
  })
  @ApiResponse({ status: 400, description: 'Refresh cookie missing or token invalid/expired.' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: { refreshToken?: string },
  ) {
    // Cookie → browser direct calls
    // Body  → server-to-server calls from next-auth jwt() callback
    const token: string | undefined = req.cookies?.[REFRESH_COOKIE] || body?.refreshToken;
    if (!token) {
      throw new BadRequestException(
        this.i18n.translate('auth.token.missingRefresh', { lang: DEFAULT_LANGUAGE }),
      );
    }

    const tokens = await this.authService.refreshTokens(token);

    // Rotate the cookie - preserves whether the session was originally "remembered"
    this.setRefreshCookie(res, tokens.refreshToken, tokens.rememberMe ?? false);

    return this.publicTokens(tokens);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Logout and revoke the refresh token cookie',
    description:
      'Reads the refresh token from the httpOnly cookie, revokes it in the database, ' +
      'and clears the cookie. Safe to call even if the cookie is already absent.',
  })
  @ApiResponse({ status: 204, description: 'Logged out. Cookie cleared.' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      await this.authService.logout(token);
    }
    this.clearRefreshCookie(res);
  }

  @Public()
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

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset password using a one-time token' })
  @ApiResponse({ status: 204, description: 'Password updated. All sessions revoked.' })
  @ApiResponse({ status: 400, description: 'Token invalid, expired, or already used.' })
  async changePassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
  }

  @Public()
  @Post('reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a soft-deleted account within the grace period' })
  @ApiResponse({
    status: 200,
    description: 'Account reactivated. Returns user profile and access token.',
  })
  @ApiResponse({ status: 400, description: 'Invalid credentials or grace period expired.' })
  async reactivateAccount(
    @Body() dto: AccountReactivationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.reactivateAccount(dto);

    this.setRefreshCookie(res, result.tokens.refreshToken, false);

    return { ...result, tokens: this.publicTokens(result.tokens) };
  }
}
