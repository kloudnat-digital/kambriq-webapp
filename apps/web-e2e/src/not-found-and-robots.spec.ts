import { test, expect } from '@playwright/test';

/**
 * P3 + P4, asserted over HTTP rather than over a decision function.
 *
 * `middleware-matcher.spec.ts` proves the matcher's shape and covers every
 * route on disk, but it reasons about a config object. Only a real request can
 * say what status code a visitor is actually served, and the status code is the
 * whole point of both chantiers:
 *
 * - a 404 that redirects is the defect P3 fixes;
 * - a "not found" page served with 200 is a soft 404, which is worse than the
 *   redirect because nothing counts it;
 * - a `noindex` header nobody sends is indistinguishable from one nobody wrote.
 *
 * `page.goto` follows redirects, so every assertion here uses `request` - the
 * raw HTTP client - which does not, and reports the first response.
 */

/** URLs the site does not serve. Each answered 307 -> /login before P3. */
const UNKNOWN_PUBLIC_PATHS = [
  '/zzz-does-not-exist',
  '/pricing',
  '/tarifs',
  '/robots.txt',
  '/sitemap.xml',
  '/legal/does-not-exist',
];

/** Routes that must go on refusing an anonymous visitor. */
const PROTECTED_PATHS = [
  '/mylands',
  '/account',
  '/admin/payments',
  '/agent/dashboard',
  '/kbs/enroll',
  '/kamnet/apply',
  '/lands',
  '/settings',
];

for (const path of UNKNOWN_PUBLIC_PATHS) {
  test(`${path} answers 404 and is not a redirect`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });

    // The status, not the body. A 200 carrying a page that says "not found" is
    // the defect rather than the fix: a crawler indexes it and a monitor calls
    // the site healthy.
    expect(response.status()).toBe(404);

    // And specifically not the redirect this used to be.
    expect(response.status()).not.toBe(307);
    expect(response.headers()['location']).toBeUndefined();
  });
}

for (const path of PROTECTED_PATHS) {
  test(`${path} still refuses an anonymous visitor`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });

    // Narrowing a matcher is the dangerous direction. This is the assertion
    // that would catch a narrowing that went too far: the page must NOT be
    // served, and it must send the visitor to the login page.
    expect(response.status()).toBe(307);
    expect(response.headers()['location']).toContain('/login');
  });
}

test('the 404 page offers a way back into the site', async ({ page }) => {
  const response = await page.goto('/zzz-does-not-exist');
  expect(response?.status()).toBe(404);

  // A dead end with no exit is the other half of the defect.
  await expect(page.getByRole('link', { name: /accueil|home/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /contact/i }).first()).toBeVisible();
});

test('every response carries the noindex header outside production', async ({ request }) => {
  /**
   * P4. The header rides on `next.config.ts`'s existing `headers()` block, so
   * it applies to every response - including the 404, which is where it matters
   * most, because a 404 is what a crawler finds when it follows a stale link.
   *
   * This suite runs against dev or a local build, neither of which sets
   * `APP_ENV=production`, so the header must be present. The production case is
   * asserted in `apps/web/src/lib/seo/robots.spec.ts`, where the environment
   * can be varied - a deployed production site is not something a test may
   * conjure.
   */
  for (const path of ['/', '/contact', '/zzz-does-not-exist']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
  }
});
