import * as z from 'zod';
import { phoneRequired } from './phone';

export const LoginResolver = z.object({
  email: z.email({
    error: 'Please enter a valid email address',
  }),
  password: z.string().min(1, {
    error: 'Password is required',
  }),
  rememberMe: z.boolean(),
});

export type LoginSchema = z.infer<typeof LoginResolver>;

const passwordStrength = z
  .string()
  .min(8, { error: 'Password must be at least 8 characters long' })
  .regex(/[A-Z]/, { error: 'Password must contain at least one uppercase letter' })
  .regex(/[0-9]/, { error: 'Password must contain at least one number' })
  .regex(/[^A-Za-z0-9]/, { error: 'Password must contain at least one special character' });

export const RegisterResolver = z.object({
  firstName: z.string().min(2, {
    error: 'First name must be at least 2 characters long',
  }),
  lastName: z.string().min(2, {
    error: 'Last name must be at least 2 characters long',
  }),
  email: z.email({
    error: 'Please provide a valid email address',
  }),
  password: passwordStrength,
  phone: phoneRequired(),
});

export type RegisterSchema = z.infer<typeof RegisterResolver>;

export const ForgotPasswordResolver = z.object({
  email: z.email({
    error: 'Please enter a valid email address',
  }),
});

export type ForgotPasswordSchema = z.infer<typeof ForgotPasswordResolver>;

export const ResetPasswordResolver = z
  .object({
    password: passwordStrength,
    confirmPassword: z.string().min(1, { error: 'Please confirm your password' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordSchema = z.infer<typeof ResetPasswordResolver>;
