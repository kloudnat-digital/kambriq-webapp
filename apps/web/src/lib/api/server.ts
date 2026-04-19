import { auth } from '@/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL && process.env.NODE_ENV === 'production') {
  throw new Error('NEXT_PUBLIC_API_URL is required in production');
}
const resolvedApiUrl = API_URL ?? 'http://localhost:3000';

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
    throw new Error(body?.message ?? `API error ${res.status} - ${path}`);
  }

  // 204 No Content - nothing to parse
  if (res.status === 204) return undefined as T;

  // NestJS wraps responses: { success: true, data: T }
  const body = await res.json();
  return (body?.data ?? body) as T;
};

// Public API
//
// For server actions and server components calling public (unauthenticated)
// endpoints - auth, registration, password reset, etc.
//
// Usage:
//   await api.post('/auth/forgot-password', { email })
//   const lands = await api.get<Land[]>('/lands/public')

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

// Authenticated API
//
// For server components and server actions that need the current user's
// access token attached automatically.
//
// Usage:
//   const user = await serverApi.get<User>('/users/me')
//   await serverApi.patch('/users/me', { firstName: 'Jean' })

const authedFetch = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const session = await auth();
  const header = session?.accessToken ? `Bearer ${session.accessToken}` : undefined;
  return baseFetch<T>(path, options, header);
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
