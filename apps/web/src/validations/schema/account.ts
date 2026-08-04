import * as z from 'zod';
import { phoneOptional } from './phone';

export const ProfileFormResolver = z.object({
  firstName: z.string().min(1, { error: 'firstNameRequired' }),
  lastName: z.string().min(1, { error: 'lastNameRequired' }),
  phone: phoneOptional('phoneInvalid'),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

export type ProfileFormSchema = z.infer<typeof ProfileFormResolver>;

const passwordFieldSchema = z
  .string()
  .min(8, { error: 'newPasswordTooShort' })
  .regex(/[A-Z]/, { error: 'newPasswordUppercase' })
  .regex(/[a-z]/, { error: 'newPasswordLowercase' })
  .regex(/\d/, { error: 'newPasswordNumber' })
  .regex(/[!@#$%^&*(),.?":{}|<>]/, { error: 'newPasswordSpecial' });

export const ChangePasswordFormResolver = z
  .object({
    currentPassword: z.string().min(1, { error: 'currentPasswordRequired' }),
    newPassword: passwordFieldSchema,
    confirmPassword: z.string().min(1, { error: 'currentPasswordRequired' }),
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    error: 'newPasswordSame',
    path: ['newPassword'],
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    error: 'confirmMismatch',
    path: ['confirmPassword'],
  });

export type ChangePasswordFormSchema = z.infer<typeof ChangePasswordFormResolver>;

export const RequestEmailChangeFormResolver = z.object({
  newEmail: z.email({ error: 'newEmailInvalid' }),
  currentPassword: z.string().min(1, { error: 'currentPasswordRequired' }),
});

export type RequestEmailChangeFormSchema = z.infer<typeof RequestEmailChangeFormResolver>;

export const PROFILE_DEFAULTS: ProfileFormSchema = {
  firstName: '',
  lastName: '',
  phone: '',
  address: '',
  city: '',
  country: '',
};

export const CHANGE_PASSWORD_DEFAULTS: ChangePasswordFormSchema = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export const REQUEST_EMAIL_CHANGE_DEFAULTS: RequestEmailChangeFormSchema = {
  newEmail: '',
  currentPassword: '',
};
