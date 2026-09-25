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

// Auth pages are public too. "Must not redirect to /login" is meaningless for
// them, so the assertion below is about the callback form, which is what a
// refused visitor is sent to.
const AUTH_PAGES = ['/login', '/forgot-password', '/reset-password', '/verify-email'];

/** `/about` -> `/fr/about`. The route as a visitor's URL bar ends up reading. */
const localised = (route: string) => new RegExp(`/(fr|en)${route === '/' ? '/?$' : `${route}$`}`);

for (const route of [...PUBLIC_ROUTES, ...AUTH_PAGES]) {
  test(`${route} is accessible without authentication, under a locale`, async ({ page }) => {
    const response = await page.goto(route);
    const finalUrl = page.url();

    expect(response?.status()).toBeLessThan(400);
    expect(finalUrl).not.toMatch(/login\?callbackUrl/);

    /**
     * The locale prefix is asserted, not merely tolerated.
     *
     * This read "allow i18n redirects but not redirects to login", which was
     * true of the old cookie-based setup and is now the weaker half of what
     * must hold: a public page that stopped being redirected to a locale would
     * satisfy it while serving a URL that resolves to nothing.
     */
    expect(finalUrl).toMatch(localised(route));
  });
}
