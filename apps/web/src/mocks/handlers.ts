import { http, HttpResponse } from 'msw';

/**
 * Mock Service Worker (MSW) request handlers.
 * Defines simulated API responses to prevent tests from hitting real backend endpoints.
 */
export const handlers = [
  // ── Auth ────────────────────────────────────────────────────────
  http.post('/api/v1/auth/login', () => {
    return HttpResponse.json({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user: {
        id: 'mock-user-id',
        email: 'test@kambriq.com',
        firstName: 'Test',
        lastName: 'User',
      },
    });
  }),

  http.post('/api/v1/auth/refresh', () => {
    return HttpResponse.json({ accessToken: 'mock-refreshed-token' });
  }),

  http.post('/api/v1/auth/logout', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Add more handlers here as you build each feature module
];
