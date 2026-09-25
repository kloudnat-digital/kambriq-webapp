'use server';

import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';
import { api } from '@/lib/api/server';
import { AUTH_ROUTES } from '@/routes';
import { createAction, ServerActionError } from './create-action';
import { getAuthErrorCause, parseReactivationSignal } from './utils/auth';
import { redirect } from '@/i18n/navigation';
import { currentLocale } from '@/lib/locale';

export const logInAction = createAction(
  async (credentials: { email: string; password: string; rememberMe: boolean }) => {
    try {
      await signIn('credentials', {
        email: credentials.email,
        password: credentials.password,
        rememberMe: String(credentials.rememberMe),
        redirectTo: '/',
      });
    } catch (error) {
      if (error instanceof AuthError) {
        const causeMessage = getAuthErrorCause(error);

        if (causeMessage) {
          // Redirects soft-deleted accounts in grace period to the reactivation flow.
          const signal = parseReactivationSignal(causeMessage);
          if (signal) {
            redirect({
              href: {
                pathname: AUTH_ROUTES.REACTIVATE,
                query: { userId: signal.userId, days: String(signal.daysRemaining) },
              },
              locale: await currentLocale(),
            });
          }

          // Propagates upstream error context (locked, inactive, attempts).
          throw new ServerActionError(causeMessage, 401);
        }

        throw new ServerActionError('Invalid email or password.', 401);
      }

      throw error; // NEXT_REDIRECT or unhandled - let createAction decide
    }
  },
);

export const logOutAction = async (): Promise<void> => {
  // Backend revocation occurs in `auth.config` `events.signOut` to ensure JWT access,
  // circumventing server-side fetch constraints regarding refresh token cookies.
  await signOut({ redirectTo: '/' });
};

export const registerAction = createAction(
  async (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
    language?: string;
  }) => {
    try {
      await api.post('/auth', { ...data, language: data.language ?? 'fr' });
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Registration failed.',
        400,
      );
    }
  },
);

// Conforms to OWASP A07 by abstracting email existence across verification and reset responses.

export const forgotPasswordAction = createAction(async (email: string) => {
  try {
    await api.post('/auth/forgot-password', { email });
  } catch {
    throw new ServerActionError('Something went wrong. Please try again.', 500);
  }
});

export const resetPasswordAction = createAction(async (token: string, newPassword: string) => {
  try {
    await api.post('/auth/reset-password', { token, newPassword });
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error
        ? error.message
        : 'Failed to reset password. The link may have expired.',
      400,
    );
  }
});

export const verifyEmailAction = createAction(async (token: string) => {
  try {
    await api.post('/auth/verify-email', { token });
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Verification failed. The link may have expired.',
      400,
    );
  }
});

export const resendVerificationAction = createAction(async (email: string) => {
  try {
    await api.post('/auth/resend-verification', { email });
  } catch {
    throw new ServerActionError('Failed to resend verification email. Please try again.', 500);
  }
});

export const reactivateAccountAction = createAction(
  async (data: { email: string; password: string }) => {
    try {
      await api.post('/auth/reactivate', data);
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Account reactivation failed.',
        400,
      );
    }

    await autoSignIn(data.email, data.password);
  },
);

export const autoSignIn = async (email: string, password: string): Promise<void> => {
  try {
    await signIn('credentials', {
      email,
      password,
      rememberMe: 'false',
      redirectTo: '/',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect({ href: AUTH_ROUTES.LOGIN, locale: await currentLocale() });
    }
    throw error; // NEXT_REDIRECT
  }
};
