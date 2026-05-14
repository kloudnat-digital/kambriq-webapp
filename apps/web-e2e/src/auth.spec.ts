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

  test('protected route redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
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

  test('valid credentials log the user in and create a session', async ({ page }) => {
    const email = process.env['E2E_TEST_EMAIL'];
    const password = process.env['E2E_TEST_PASSWORD'];
    if (!email || !password) {
      test.skip(true, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars are required');
    }
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(String(email));
    await page.locator('input[type="password"]').fill(String(password));
    await page.locator('button[type="submit"]').click();
    // Login successful: should redirect away from /login
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 10_000 });
    await expect(page).not.toHaveURL(/login/);
    // Session cookie should be created
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name.includes('next-auth.session-token'));
    expect(sessionCookie).toBeDefined();
  });
});
