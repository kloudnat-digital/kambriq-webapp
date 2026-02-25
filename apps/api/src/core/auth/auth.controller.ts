import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from '@kambriq/common';
import {
  AccountReactivationDto,
  EmailVerificationDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResendVerificationEmailDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @ApiOperation({
    summary: 'Register a new user account',
    description:
      'Creates a new account with a CLIENT role. Sends a verification email. Returns user info and JWT tokens on success.',
  })
  @ApiResponse({
    status: 201,
    description: 'Account created. Returns user profile and auth tokens.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (weak password, invalid email, etc.).',
  })
  @ApiResponse({
    status: 409,
    description: 'An account with this email already exists.',
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate with email and password',
    description:
      'Returns JWT access and refresh tokens on success. Accounts are locked for 15 minutes after 5 failed attempts. If the account was soft-deleted within the grace period, a reactivation response is returned instead of tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful. Returns user profile and tokens.',
  })
  @ApiResponse({ status: 400, description: 'Invalid credentials.' })
  @ApiResponse({
    status: 401,
    description: 'Account locked, suspended, or email not verified.',
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate JWT tokens using a refresh token',
    description:
      'Revokes the provided refresh token and issues a new access + refresh token pair. Implements token rotation — the old refresh token is immediately invalidated.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens rotated. Returns new access and refresh tokens.',
  })
  @ApiResponse({
    status: 400,
    description: 'Refresh token is invalid, expired, or already revoked.',
  })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email address with a one-time token',
    description:
      'Confirms the email address using the token delivered during registration. Tokens expire after 24 hours and are single-use.',
  })
  @ApiResponse({ status: 200, description: 'Email verified successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Token is invalid, already used, or expired.',
  })
  async verifyEmail(@Body() dto: EmailVerificationDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend the email verification link',
    description:
      'Sends a new verification email if the account exists and is not yet verified. Always returns 200 to prevent email enumeration.',
  })
  @ApiResponse({
    status: 200,
    description:
      'If the address is registered and unverified, a new link has been sent.',
  })
  async resendVerificationEmail(@Body() dto: ResendVerificationEmailDto) {
    return this.authService.resendVerificationEmail(dto.email);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Logout and invalidate the refresh token',
    description:
      'Revokes the provided refresh token. The access token remains valid until natural expiry — clients should discard it immediately. Accepts an unauthenticated request so logout works even with an expired access token.',
  })
  @ApiResponse({
    status: 204,
    description: 'Logged out. Refresh token revoked.',
  })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Request a password reset link',
    description:
      'Sends a password reset email if the address is associated with an active account. Always returns 204 to prevent email enumeration. Reset links expire after 1 hour.',
  })
  @ApiResponse({
    status: 204,
    description:
      'If the account exists and is active, a reset email has been sent.',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reset password using a one-time token',
    description:
      'Sets a new password using the one-time token from the reset email. Invalidates all existing sessions on success. Tokens expire after 1 hour.',
  })
  @ApiResponse({
    status: 204,
    description: 'Password updated. All sessions revoked.',
  })
  @ApiResponse({
    status: 400,
    description: 'Token is invalid, expired, or already used.',
  })
  async changePassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
  }

  @Public()
  @Post('reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reactivate a soft-deleted account within the grace period',
    description:
      'Restores an account that was deleted by the user within the 30-day grace period. Requires the original credentials for verification. Returns user profile and tokens on success.',
  })
  @ApiResponse({
    status: 200,
    description: 'Account reactivated. Returns user profile and tokens.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid credentials, or the 30-day grace period has expired.',
  })
  async reactivateAccount(@Body() dto: AccountReactivationDto) {
    return this.authService.reactivateAccount(dto);
  }
}
