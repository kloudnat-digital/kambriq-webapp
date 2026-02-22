import { SUPPORTED_LANGUAGES } from '@kambriq/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ----- Update Own Profile -----
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  language: z.enum(SUPPORTED_LANGUAGES).optional(),

  avatarUrl: z.string().url().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}

// ----- Update  user (roles, active status) -----
export const adminUpdateUserSchema = z.object({
  roleCodes: z.array(z.string()).optional(),
});

export class AdminUpdateUserDto extends createZodDto(adminUpdateUserSchema) {}

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
    idVerified: boolean;
  } | null;
}
