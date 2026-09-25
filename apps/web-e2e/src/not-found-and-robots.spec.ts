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

/**
 * URLs the site does not serve, in unprefixed form. Each answered 307 -> /login
 * before P3, and each must answer 404 now.
 *
 * None of these is in the proxy matcher, so the request never reaches the
 * proxy: `[locale]` matches the first segment, `dynamicParams = false` refuses
 * a value that is not a configured locale, and Next answers 404 directly.
 */
const UNKNOWN_PUBLIC_PATHS = ['/zzz-does-not-exist', '/pricing', '/tarifs'];

/**
 * Unknown URLs UNDER a prefix the matcher does carry.
 *
 * `/legal/:path*` is matched so that `/legal/privacy` can be redirected to a
 * locale, which means an unknown path beneath it is redirected first and 404s
 * on the second request. Both hops are asserted: stopping at the 307 would not
 * distinguish this from a login wall.
 */
const UNKNOWN_UNDER_A_MATCHED_PREFIX = ['/legal/does-not-exist', '/blog/a-post-that-moved'];

/** Routes that must go on refusing an anonymous visitor, locale and all. */
const PROTECTED_PATHS = [
  '/fr/mylands',
  '/fr/account',
  '/fr/admin/payments',
  '/fr/agent/dashboard',
  '/fr/kbs/enroll',
  '/fr/kamnet/apply',
  '/fr/lands',
  '/fr/settings',
  '/en/mylands',
  '/en/admin/payments',
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

for (const path of UNKNOWN_UNDER_A_MATCHED_PREFIX) {
  test(`${path} reaches a 404 through the locale redirect, not a login wall`, async ({
    request,
  }) => {
    const first = await request.get(path, { maxRedirects: 0 });
    expect(first.status()).toBe(307);

    const location = first.headers()['location'];
    // The whole point: it is sent to a locale, never to login. A negation-based
    // gate under the wider matcher would send it to login instead.
    expect(location).toMatch(/\/(fr|en)\//);
    expect(location).not.toContain('/login');

    const second = await request.get(location, { maxRedirects: 0 });
    expect(second.status()).toBe(404);
  });
}

for (const path of PROTECTED_PATHS) {
  test(`${path} still refuses an anonymous visitor`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });

    // Narrowing a gate is the dangerous direction. This is the assertion that
    // would catch a narrowing that went too far: the page must NOT be served,
    // and it must send the visitor to the login page of its own locale.
    expect(response.status()).toBe(307);
    const location = response.headers()['location'];
    expect(location).toContain('/login');
    expect(location).toContain(`/${path.split('/')[1]}/login`);
  });
}

test('the 404 page offers a way back into the site', async ({ page }) => {
  const response = await page.goto('/fr/zzz-does-not-exist');
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
  for (const path of ['/', '/fr', '/fr/contact', '/fr/zzz-does-not-exist']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
  }
});
