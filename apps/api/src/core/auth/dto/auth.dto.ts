import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { SUPPORTED_LANGUAGES } from '@kambriq/common';

const passwordFieldSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character');

// ---- Register ----------
export const registerSchema = z.object({
  email: z.email('Invalid email address'),
  password: passwordFieldSchema,
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().optional(),
  language: z.enum(SUPPORTED_LANGUAGES).default('fr'),
});

export class RegisterDto extends createZodDto(registerSchema) {}

// ----- Login ----------
export const loginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

export class LoginDto extends createZodDto(loginSchema) {}

// ----- Refresh Token ----------
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}

// ----- EmailVerification ----------
export const emailVerificationSchema = z.object({
  token: z.string().min(1),
});

export class EmailVerificationDto extends createZodDto(emailVerificationSchema) {}

export const resendVerificationEmailSchema = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
});

export class ResendVerificationEmailDto extends createZodDto(resendVerificationEmailSchema) {}

// ----- Forgot / Reset Password ----------
export const forgotPasswordSchema = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
});

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordFieldSchema,
});

export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}

// ----- Account Reactivation ----------
export const accountReactivationSchema = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

export class AccountReactivationDto extends createZodDto(accountReactivationSchema) {}

// ----- Token Response -----
// refreshToken and rememberMe are internal - the controller sets the cookie and
// strips both fields before sending the response to the client.
export class TokenResponse {
  declare accessToken: string;
  declare refreshToken: string;
  declare expiresAt: Date;
  /** Internal: whether this was a "remember me" session. Used by the controller to set cookie maxAge. */
  rememberMe?: boolean;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    language: string;
  };
  tokens: TokenResponse;
}

export interface GracePeriodResponse {
  requiresReactivation: true;
  userId: string;
  daysRemaining: number;
  message: string;
}
