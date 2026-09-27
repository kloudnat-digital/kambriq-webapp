'use server';

import { auth } from '@/auth';
import { serverApi } from '@/lib/api/server';
import { revalidateLocalisedPath } from './revalidate';
import { createAction, ServerActionError } from './create-action';
import type { Me, AvatarUploadUrl } from '@/types/account';

export const getMe = createAction(async () => {
  return serverApi.get<Me>('/users/me');
});

type UpdateMePayload = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  language?: 'en' | 'fr';
  avatarUrl?: string;
  address?: string;
  city?: string;
  country?: string;
  emailNotifications?: boolean;
};

export const updateMe = createAction(async (data: UpdateMePayload, revalidate?: string) => {
  try {
    const result = await serverApi.patch<Me>('/users/me', data);
    if (revalidate) await revalidateLocalisedPath(revalidate);
    return result;
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Profile update failed.',
      400,
    );
  }
});

/** What switching the page language did to the account's stored language. */
export type LanguageFollow = 'visitor' | 'unchanged' | 'saved';

/**
 * J4: switching the page language also sets a signed-in person's account
 * language, which is the language of their emails. A visitor has no account,
 * so nothing is read or written. The session is checked before any call so
 * an expired one never turns a language switch into a sign-in redirect.
 */
export const followLanguage = createAction(
  async (language: 'en' | 'fr'): Promise<LanguageFollow> => {
    const session = await auth();
    if (!session?.accessToken || session.error) return 'visitor';
    try {
      const me = await serverApi.get<Me>('/users/me');
      if (me.language === language) return 'unchanged';
      await serverApi.patch<Me>('/users/me', { language });
      return 'saved';
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Language update failed.',
        400,
      );
    }
  },
);

export const changePassword = createAction(
  async (data: { currentPassword: string; newPassword: string }) => {
    try {
      return await serverApi.patch<{ message: string }>('/users/me/password', data);
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Password change failed.',
        400,
      );
    }
  },
);

export const requestEmailChange = createAction(
  async (data: { newEmail: string; currentPassword: string }) => {
    try {
      return await serverApi.patch<{ message: string }>('/users/me/email', data);
    } catch (error) {
      throw new ServerActionError(
        error instanceof Error ? error.message : 'Email change request failed.',
        400,
      );
    }
  },
);

export const confirmEmailChange = createAction(async (token: string) => {
  try {
    return await serverApi.post<{ message: string }>('/users/me/email/confirm', { token });
  } catch (error) {
    throw new ServerActionError(
      error instanceof Error ? error.message : 'Email confirmation failed.',
      400,
    );
  }
});

export const getAvatarUploadUrl = createAction(
  async (data: { filename: string; contentType: string }) => {
    return serverApi.post<AvatarUploadUrl>('/users/me/avatar/upload-url', data);
  },
);
