import { test, expect } from '@playwright/test';

// Routes that must be accessible without authentication (no redirect to /login)
const PUBLIC_ROUTES = ['/', '/register', '/about', '/contact', '/faq'];

for (const route of PUBLIC_ROUTES) {
  test(`${route} is accessible without authentication`, async ({ page }) => {
    const response = await page.goto(route);
    // Allow i18n redirects (e.g. / → /fr/) but not redirects to login
    const finalUrl = page.url();
    expect(response?.status()).toBeLessThan(400);
    expect(finalUrl).not.toMatch(/login/);
  });
}
