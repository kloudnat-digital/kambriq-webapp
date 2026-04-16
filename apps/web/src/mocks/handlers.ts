import { http, HttpResponse } from 'msw';

/**
 * MSW request handlers - define mock API responses here.
 *
 * How it works:
 *   - `http.get/post/patch/delete(url, resolver)` intercepts matching requests
 *   - The resolver receives the request and returns an HttpResponse
 *   - These handlers are used in Jest tests (via server.ts) so tests never
 *     hit the real backend
 *
 * Add handlers for each backend endpoint as you build features.
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
