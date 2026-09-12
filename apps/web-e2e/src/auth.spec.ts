import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page is accessible and renders form', async ({ page }) => {
    await page.goto('/login');
    // Allow i18n redirect (e.g. /fr/login)
    await expect(page).toHaveURL(/login/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('register page is accessible and renders form', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveURL(/register/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  /**
   * The target has to be a route this site actually serves.
   *
   * This test pointed at `/dashboard` for months. **There is no such page** -
   * the agent dashboard is at `/agent/dashboard` - and it passed anyway, because
   * the middleware was a negative matcher that redirected every URL the site does
   * not serve straight to login. So the assertion was satisfied by the very
   * defect `P3` existed to remove, and it went red on the day the product became
   * correct rather than on the day anything broke.
   *
   * Two things are asserted here, and the second is what stops it going hollow
   * again. A redirect on a protected route says little on its own: it said
   * exactly the same thing back when *everything* redirected. It only means
   * something once an unserved path is known to do something else.
   */
  test('protected route redirects to login when unauthenticated', async ({ page, request }) => {
    const unknown = await request.get(`/not-a-route-${Date.now()}`, { maxRedirects: 0 });
    expect(
      unknown.status(),
      'a path the site does not serve must 404; while it redirected, this test proved nothing',
    ).toBe(404);

    const protectedRoute = await request.get('/agent/dashboard', { maxRedirects: 0 });
    expect(protectedRoute.status()).toBe(307);
    expect(protectedRoute.headers()['location']).toContain('/login');

    await page.goto('/agent/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('invalid credentials show an error without crashing', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/login/);
    await page.locator('input[type="email"]').fill('nobody@example.com');
    await page.locator('input[type="password"]').fill('wrong-password-123');
    await page.locator('button[type="submit"]').click();
    // Should stay on login page (no crash/redirect to 500)
    await expect(page).toHaveURL(/login/);
  });

  // The two checks below hit the NextAuth route handler directly. The proxy
  // matcher excludes /api, so they exercise the auth endpoints themselves
  // rather than the redirect middleware, and they need no account.
  test('GET /api/auth/providers returns json with credentials provider', async ({ request }) => {
    const response = await request.get('/api/auth/providers');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('credentials');
    expect(body.credentials).toHaveProperty('id', 'credentials');
  });

  test('GET /api/auth/csrf returns a csrfToken', async ({ request }) => {
    const response = await request.get('/api/auth/csrf');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('csrfToken');
    expect(typeof body.csrfToken).toBe('string');
    expect(body.csrfToken.length).toBeGreaterThan(20);
  });
});
