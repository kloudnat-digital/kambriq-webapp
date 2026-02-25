import { SUPPORTED_LANGUAGES } from '@kambriq/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const passwordFieldSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(
    /[!@#$%^&*(),.?":{}|<>]/,
    'Password must contain at least one special character',
  );

// ----- Update Own Profile -----
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  language: z.enum(SUPPORTED_LANGUAGES).optional(),

  avatarUrl: z.url().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}

// ----- Change Password -----
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordFieldSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must differ from the current password',
    path: ['newPassword'],
  });

export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}

// ----- Replace all user roles (atomic) -----
export const adminUpdateUserSchema = z.object({
  roleCodes: z.array(z.string()).optional(),
});

export class AdminUpdateUserDto extends createZodDto(adminUpdateUserSchema) {}

// ----- Request email change -----
export const requestEmailChangeSchema = z.object({
  newEmail: z.string().email('Invalid email address'),
  currentPassword: z.string().min(1, 'Current password is required'),
});

export class RequestEmailChangeDto extends createZodDto(
  requestEmailChangeSchema,
) {}

// ----- Confirm email change -----
export const confirmEmailChangeSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export class ConfirmEmailChangeDto extends createZodDto(
  confirmEmailChangeSchema,
) {}

// ----- Submit ID document -----
export const submitIdDocumentSchema = z.object({
  idDocumentUrl: z.string().url('Must be a valid URL'),
});

export class SubmitIdDocumentDto extends createZodDto(submitIdDocumentSchema) {}

// ----- Admin: review ID document -----
export const reviewIdDocumentSchema = z
  .object({
    status: z.enum(['verified', 'rejected']),
    rejectionReason: z.string().min(1).optional(),
  })
  .refine((data) => data.status !== 'rejected' || !!data.rejectionReason, {
    message: 'Rejection reason is required when rejecting',
    path: ['rejectionReason'],
  });

export class ReviewIdDocumentDto extends createZodDto(reviewIdDocumentSchema) {}

// ----- Add / Remove a single role -----
export const roleCodeSchema = z.object({
  roleCode: z.string().min(1, 'Role code is required'),
});

export class RoleCodeDto extends createZodDto(roleCodeSchema) {}

// ----- Sanitized User Response ----------
export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  emailVerified: boolean;
  roles: string[];
  createdAt: string;
  lastLoginAt: string | null;
  language: string;
  profile: {
    avatarUrl: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    idVerificationStatus: string;
    idVerifiedAt: string | null;
  } | null;
}
