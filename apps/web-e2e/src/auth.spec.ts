import { test, expect } from '@playwright/test';

/**
 * A28 - the one journey nothing covered: a login that SUCCEEDS, end to end.
 *
 * The suite proved the login page renders, that bad credentials are refused, and
 * that the NextAuth endpoints answer - every path except the one that matters,
 * a real user getting in. A green suite that never logs anybody in is the shape
 * this registry keeps finding: a check that passes by not asking the question.
 *
 * The account is minted the way #79 settled it, not from a pre-provisioned
 * secret (the old E2E_TEST_EMAIL approach, whose secret never existed, so the
 * test skipped and covered nothing): a disposable maildrop.cc address is
 * registered through the API, its verification token is read back from the
 * mailbox, and the address is verified - because login refuses an unverified
 * email, so a test that skipped verification would prove the refusal, not the
 * success.
 */
const MAILDROP = 'https://api.maildrop.cc/graphql';

async function maildropToken(
  mailbox: string,
  pattern: RegExp,
  timeoutMs = 60_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const subjects: string[] = [];
  const q = async (query: string) => {
    const res = await fetch(MAILDROP, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok)
      throw new Error(`maildrop unavailable (HTTP ${res.status}) - not a product failure`);
    return res.json() as Promise<{
      data?: { inbox?: Array<{ id: string; subject: string }>; message?: { html: string } };
    }>;
  };
  while (Date.now() < deadline) {
    const list = (await q(`query{inbox(mailbox:"${mailbox}"){id subject}}`)).data?.inbox ?? [];
    for (const m of list) {
      subjects.push(m.subject);
      const html =
        (await q(`query{message(mailbox:"${mailbox}",id:"${m.id}"){html}}`)).data?.message?.html ??
        '';
      const found = pattern.exec(html);
      if (found?.[1]) return found[1];
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(
    `no token in mailbox ${mailbox} after ${timeoutMs}ms. Subjects seen: ${subjects.join(' | ') || '(empty)'}`,
  );
}

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

  test('a real user can log in: verified account reaches an authenticated page with a session', async ({
    page,
    request,
  }) => {
    const stamp = `${Date.now()}.${Math.floor(Math.random() * 1e4)}`;
    const mailbox = `e2e-login.${stamp}`;
    const email = `${mailbox}@maildrop.cc`;
    const password = 'Test1234!';

    // Mint through the API, the #79 way.
    const registered = await request.post('/api/v1/auth', {
      data: {
        email,
        password,
        firstName: 'E2E',
        lastName: 'Login',
        phone: '690000000',
        language: 'fr',
      },
    });
    expect(registered.status(), 'registration should return 201').toBe(201);

    const token = await maildropToken(mailbox, /verify-email\?token=([0-9a-fA-F]+)/);
    const verified = await request.post('/api/v1/auth/verify-email', { data: { token } });
    expect(verified.status(), 'email verification should return 200').toBe(200);

    // The actual subject of the test: logging in through the UI.
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /connecter|log ?in|sign ?in/i }).click();

    // Success is leaving /login for an authenticated page, with a session cookie set.
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15_000 });
    await expect(page).not.toHaveURL(/login/);

    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name.includes('session-token'))).toBe(true);
  });
});
