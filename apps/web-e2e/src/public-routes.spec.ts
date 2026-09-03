import { test, expect } from '@playwright/test';

// Every public route that has a real page, so a route that stops being reachable
// is caught here rather than by a user.
//
// Keep in sync with PUBLIC_PATHS in apps/web/src/routes.ts. Several entries
// there are prefixes with no index page of their own (/legal, /products,
// /verify-certificate), so they are represented by a real sub-page below.
const PUBLIC_ROUTES = [
  '/',
  '/register',
  '/about',
  '/contact',
  '/faq',
  '/blog',
  '/methode',
  '/plan',
  '/legal/privacy',
  '/legal/terms',
  '/legal/mentions',
  '/legal/rgpd',
  '/products/lands',
  '/products/verify',
  '/products/kbs',
  '/products/kamnet',
];

// Auth pages are public too, but "must not redirect to /login" is meaningless
// for them, so they are only asserted to render.
const AUTH_PAGES = ['/login', '/forgot-password', '/reset-password', '/verify-email'];

for (const route of PUBLIC_ROUTES) {
  test(`${route} is accessible without authentication`, async ({ page }) => {
    const response = await page.goto(route);
    // Allow i18n redirects (e.g. / → /fr/) but not redirects to login
    const finalUrl = page.url();
    expect(response?.status()).toBeLessThan(400);
    expect(finalUrl).not.toMatch(/login/);
  });
}

for (const route of AUTH_PAGES) {
  test(`${route} renders without authentication`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBeLessThan(400);
  });
}
