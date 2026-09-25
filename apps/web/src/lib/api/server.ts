import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { currentLocale } from '@/lib/locale';
import { auth } from '@/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL && process.env.NODE_ENV === 'production') {
  throw new Error('NEXT_PUBLIC_API_URL is required in production');
}
const resolvedApiUrl = API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Core

const baseFetch = async <T>(
  path: string,
  options?: RequestInit,
  authHeader?: string,
): Promise<T> => {
  const res = await fetch(`${resolvedApiUrl}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[API ${res.status}] ${path}`, JSON.stringify(body, null, 2));
    }
    throw new ApiError(body?.message ?? `API error ${res.status} - ${path}`, res.status);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  // Extract payload from NestJS standard response wrapper ({ success, data, meta }).
  // Retain the full response body for paginated endpoints to expose metadata.
  const body = await res.json();
  if (body?.meta) return body as T;
  return (body?.data ?? body) as T;
};

/**
 * Public API client for server actions and server components.
 * Intended for unauthenticated endpoints (e.g., authentication, registration).
 *
 * @example
 * await api.post('/auth/forgot-password', { email })
 * const lands = await api.get<Land[]>('/lands/public')
 */

export const api = {
  get: <T>(path: string) => baseFetch<T>(path, { method: 'GET' }),

  post: <T>(path: string, data?: unknown) =>
    baseFetch<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),

  put: <T>(path: string, data?: unknown) =>
    baseFetch<T>(path, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),

  patch: <T>(path: string, data?: unknown) =>
    baseFetch<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),

  delete: <T>(path: string) => baseFetch<T>(path, { method: 'DELETE' }),
};

/**
 * Authenticated API client for server actions and server components.
 * Automatically attaches the current user's access token to requests.
 *
 * @example
 * const user = await serverApi.get<User>('/users/me')
 * await serverApi.patch('/users/me', { firstName: 'Jean' })
 */

const getSession = cache(auth);

/** Redirects the user to the login page while preserving their original destination. */
const redirectToLogin = async (): Promise<never> => {
  const referer = (await headers()).get('referer');
  let callbackUrl = '/';
  if (referer) {
    try {
      const url = new URL(referer);
      const path = url.pathname + url.search;
      if (!path.startsWith('/login')) {
        callbackUrl = path;
      }
    } catch {
      // ignore malformed referer
    }
  }
  redirect({
    href: { pathname: '/login', query: { callbackUrl } },
    locale: await currentLocale(),
  });
};

const authedFetch = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const session = await getSession();
  if (session?.error === 'RefreshTokenError') {
    await redirectToLogin();
  }
  const header = session?.accessToken ? `Bearer ${session.accessToken}` : undefined;

  try {
    return await baseFetch<T>(path, options, header);
  } catch (error) {
    // Handle scenarios where the access token is invalid but has not yet expired locally.
    // A 401 response indicates API rejection, necessitating a login redirect.
    if (error instanceof ApiError && error.status === 401) {
      await redirectToLogin();
    }
    throw error;
  }
};

export const serverApi = {
  get: <T>(path: string) => authedFetch<T>(path, { method: 'GET' }),

  post: <T>(path: string, data?: unknown) =>
    authedFetch<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),

  put: <T>(path: string, data?: unknown) =>
    authedFetch<T>(path, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),

  patch: <T>(path: string, data?: unknown) =>
    authedFetch<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),

  delete: <T>(path: string) => authedFetch<T>(path, { method: 'DELETE' }),
};
