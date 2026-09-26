import { test, expect } from '@playwright/test';

/**
 * Locale-prefixed routing, asserted over HTTP against a running app.
 *
 * Every other check of this lives in a unit suite reasoning about a config
 * object or a decision function. Only a real request says what a visitor is
 * served, and this change is entirely about what URL a visitor ends up on:
 *
 * - one URL must serve one language, or a crawler - which sends no cookie -
 *   can only ever see the default one, and `hreflang` has no URLs to point at;
 * - an unprefixed URL must be redirected rather than 404, or every link
 *   anybody has already shared breaks;
 * - a first segment that is not a configured locale must 404 rather than
 *   render the home page, which is a soft 404 nothing counts.
 *
 * `page.goto` follows redirects, so the status assertions use `request`, the
 * raw HTTP client, which does not.
 */

const LOCALES = ['fr', 'en'] as const;

test('the bare root redirects to a locale', async ({ request }) => {
  const response = await request.get('/', { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers()['location']).toMatch(/\/(fr|en)$/);
});

for (const path of ['/about', '/contact', '/legal/privacy', '/products/lands']) {
  test(`${path} is redirected to a locale rather than 404ing`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    const location = response.headers()['location'];
    expect(location).toMatch(new RegExp(`/(fr|en)${path}$`));
    // A public page must never be sent to login, whatever the matcher covers.
    expect(location).not.toContain('/login');
  });
}

for (const locale of LOCALES) {
  test(`/${locale}/about is served directly, with lang="${locale}"`, async ({ page, request }) => {
    const response = await request.get(`/${locale}/about`, { maxRedirects: 0 });
    expect(response.status()).toBe(200);

    // The document's language has to agree with the URL, or a screen reader and
    // a crawler are both told the wrong thing while the text is right.
    await page.goto(`/${locale}/about`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
  });
}

test('the two locales serve different text at the same route', async ({ page }) => {
  /**
   * The property the whole change exists for: one URL, one language.
   *
   * Asserted as a difference rather than against fixed copy, so it survives
   * every edit to the marketing text and still fails if the locale segment
   * stops selecting a catalogue.
   */
  await page.goto('/fr/about');
  const french = String(await page.locator('main').textContent());

  await page.goto('/en/about');
  const english = String(await page.locator('main').textContent());

  expect(french.length).toBeGreaterThan(50);
  expect(english.length).toBeGreaterThan(50);
  expect(english).not.toBe(french);
});

for (const segment of ['de', 'es', 'zzz']) {
  test(`/${segment}/about is not a locale and answers 404`, async ({ request }) => {
    /**
     * `[locale]` matches any first segment, so without the `(site)` layout's
     * `hasLocale` refusal this would render the French page at `/de/about` with HTTP 200 -
     * a soft 404 under a language the site does not offer.
     */
    const response = await request.get(`/${segment}/about`, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
  });
}

test('every 404 is the branded page, under a locale or above one (P31)', async ({ page }) => {
  /**
   * An unconfigured first segment used to get Next's built-in page: the refusal
   * sat in the root layout, and a `notFound()` thrown there has no boundary
   * above it. Since P31 every page sits in `(site)`, whose layout refuses the
   * segment below the branded boundary.
   */
  await page.goto('/fr/zzz-does-not-exist');
  await expect(page.getByRole('link', { name: /accueil/i }).first()).toBeVisible();

  await page.goto('/zzz-not-a-locale');
  await expect(page.getByRole('link', { name: /accueil/i }).first()).toBeVisible();
});

test('the 404 above a locale speaks the visitor language', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-GB' });
  const page = await context.newPage();
  const response = await page.goto('/pricing');
  expect(response?.status()).toBe(404);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('link', { name: /home/i }).first()).toBeVisible();
  await context.close();
});

test('switching language keeps the visitor on the same page', async ({ page }) => {
  /**
   * The switcher is a navigation now, not a cookie write.
   *
   * It used to call a server action that set `NEXT_LOCALE` and then refresh, so
   * the URL never changed and one URL served two languages. This asserts the
   * thing that replaced it: the same page, under the other locale, in the
   * address bar.
   *
   * Targeted by its accessible name rather than by the badge it renders. The
   * badge shows the CURRENT locale - `FR` while reading French - so a selector
   * built on `EN` matches nothing, which is what the first version of this test
   * did and why it read as a broken switcher.
   */
  /**
   * `/plan` rather than `/contact`, and the reason is a gap rather than a
   * preference: `QuickActions` carries the switcher and is mounted PER PAGE, on
   * 8 of the 15 public pages. `/contact`, `/about`, `/faq` and all four legal
   * pages have no language control at all.
   *
   * That predates this change and is not repaired here, because moving a
   * floating control into shared chrome is a design decision about the public
   * site rather than a routing fix. It matters more than it did: a cookie
   * carried the choice between pages, and a URL does not, so an English visitor
   * who lands on `/fr/contact` from a search result now has no way out of it.
   * Recorded in the register.
   */
  await page.goto('/fr/plan');

  /**
   * A51 - activated from the keyboard, with no style injected.
   *
   * The first version hid the TanStack Query devtools with `page.addStyleTag`
   * before each click, because their launcher overlapped the switcher. Two
   * things were wrong with that:
   *
   * - the devtools render only under `next dev`. CI runs this suite against the
   *   deployed dev site, whose image is a production build, so there was nothing
   *   to hide;
   * - in Firefox the injection itself failed about one run in five - "blocked a
   *   JavaScript eval (script-src)": the page's CSP has no `'unsafe-eval'` - and
   *   the job's retry turned it green. Measured locally against dev: 2 failures
   *   in 10 runs, both inside `addStyleTag`.
   *
   * Pressing Enter on the focused switcher is what a keyboard user does, and a
   * key press is not intercepted by an element drawn over the button, so the
   * same test holds against `next dev` too.
   */
  const switchTo = async (currentLabel: string) => {
    const button = page.getByRole('button', { name: currentLabel });
    await button.focus();
    await button.press('Enter');
  };

  await switchTo('Changer de langue');
  await page.waitForURL(/\/en\/plan/);

  expect(new URL(page.url()).pathname).toBe('/en/plan');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  // And back, so a one-way switch cannot pass.
  await switchTo('Change language');
  await page.waitForURL(/\/fr\/plan/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});

test('the alternate-language links are advertised to crawlers', async ({ request }) => {
  /**
   * next-intl's middleware sets `Link: <...>; rel="alternate"; hreflang="..."`
   * on the responses it handles. It is the machine-readable half of the reason
   * for prefixing at all, and it is free only while the middleware runs on the
   * page - which is what the matcher decides.
   */
  const response = await request.get('/fr/about', { maxRedirects: 0 });
  const link = String(response.headers()['link']);

  expect(link).toContain('rel="alternate"');
  expect(link).toContain('hreflang="en"');
  expect(link).toContain('hreflang="fr"');
});
