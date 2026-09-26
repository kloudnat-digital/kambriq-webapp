import * as z from 'zod';

/*
 * J12: every refusal below is a KEY under `auth.validation` in the message
 * catalogues, rendered by the form in the reader's language
 * (`auth-messages.spec.ts`), never an English sentence.
 */
import { phoneRequired } from './phone';

export const LoginResolver = z.object({
  email: z.email({ error: 'emailInvalid' }),
  password: z.string().min(1, { error: 'passwordRequired' }),
  rememberMe: z.boolean(),
});

export type LoginSchema = z.infer<typeof LoginResolver>;

const passwordStrength = z
  .string()
  .min(8, { error: 'passwordTooShort' })
  .regex(/[A-Z]/, { error: 'passwordNeedsUppercase' })
  .regex(/[0-9]/, { error: 'passwordNeedsNumber' })
  .regex(/[^A-Za-z0-9]/, { error: 'passwordNeedsSpecial' });

export const RegisterResolver = z.object({
  firstName: z.string().min(2, { error: 'firstNameTooShort' }),
  lastName: z.string().min(2, { error: 'lastNameTooShort' }),
  email: z.email({ error: 'emailInvalid' }),
  password: passwordStrength,
  phone: phoneRequired('phoneInvalid'),
});

export type RegisterSchema = z.infer<typeof RegisterResolver>;

export const ForgotPasswordResolver = z.object({
  email: z.email({ error: 'emailInvalid' }),
});

export type ForgotPasswordSchema = z.infer<typeof ForgotPasswordResolver>;

export const ResetPasswordResolver = z
  .object({
    password: passwordStrength,
    confirmPassword: z.string().min(1, { error: 'confirmPasswordRequired' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwordsDoNotMatch',
    path: ['confirmPassword'],
  });

export type ResetPasswordSchema = z.infer<typeof ResetPasswordResolver>;

export const ReactivateResolver = z.object({
  email: z.email({ error: 'emailInvalid' }),
  password: z.string().min(1, { error: 'passwordRequired' }),
});

export type ReactivateSchema = z.infer<typeof ReactivateResolver>;
