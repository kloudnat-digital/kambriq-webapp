import { test, expect, type APIRequestContext } from '@playwright/test';
import { authSlot } from './support/auth-budget';
import { apiToken } from './support/sessions';

/**
 * I45 - the front door, walked the way a person walks it: from the email.
 *
 * An agent reserves a parcel for a new client; the API emails that client an
 * invitation. Until I45 its link led to `/auth/set-password`, a page that did
 * not exist - every new client landed on a 404. The journeys never saw it: they
 * take the token out of the mailbox and call the API, which was always fine.
 *
 * So this opens **the link exactly as the email carries it**, in a browser, sets
 * a password on the page it leads to, and signs in through the login page. It
 * gives the parcel back afterwards, like journey 4.
 */
const MAILDROP = 'https://api.maildrop.cc/graphql';

/**
 * One browser proves a link. Each walk signs in several times through the API
 * and the page; in three browsers from one runner address that exhausted the
 * login rate limit and took WebKit's own login test down with it.
 */
test.skip(({ browserName }) => browserName !== 'chromium', 'one browser proves an emailed link');

/**
 * **Opt-in** (`RUN_EMAILED_LINKS=1`), not part of every deploy's E2E run. The two
 * walks sign in seven times between them, and the login is limited to 10 a
 * minute per visitor; the suite signs in from one runner address, so with them
 * it ran over (429s in the API log during the run) and the last sign-in to come
 * failed - Firefox's own login test among them. Proven 2/2 on dev on 27
 * September; `emailed-urls-resolve.spec.ts` checks every emailed URL on every
 * pull request. Whether page walks run on every deploy, and at what cost, is the
 * register's "Journeys bypass the page" decision.
 */
test.skip(process.env['RUN_EMAILED_LINKS'] !== '1', 'opt-in: RUN_EMAILED_LINKS=1');

const maildrop = async (query: string) => {
  const res = await fetch(MAILDROP, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`maildrop unavailable (HTTP ${res.status}) - not a product failure`);
  return res.json() as Promise<{
    data?: { inbox?: Array<{ id: string; subject: string }>; message?: { html: string } };
  }>;
};

/** The button link of the message whose subject matches, read out of the delivered HTML. */
const emailedLink = async (
  mailbox: string,
  subject: RegExp,
  timeoutMs = 120_000,
): Promise<string> => {
  const deadline = Date.now() + timeoutMs;
  const subjects: string[] = [];
  while (Date.now() < deadline) {
    const list =
      (await maildrop(`query{inbox(mailbox:"${mailbox}"){id subject}}`)).data?.inbox ?? [];
    for (const m of list) {
      subjects.push(m.subject);
      if (!subject.test(m.subject)) continue;
      const html =
        (await maildrop(`query{message(mailbox:"${mailbox}",id:"${m.id}"){html}}`)).data?.message
          ?.html ?? '';
      const href = /<a href="([^"]+)" class="btn"/.exec(html)?.[1];
      if (href) return href.replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(
    `no invitation in ${mailbox}. Subjects seen: ${subjects.join(' | ') || '(empty)'}`,
  );
};

/** A new person's own sign-in - the one kind that cannot be reused (A56: in budget). */
const apiLogin = async (request: APIRequestContext, email: string, password: string) => {
  await authSlot('login');
  const res = await request.post('/api/v1/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { data: { tokens: { accessToken: string } } }).data.tokens
    .accessToken;
};

test('I45 - a new client sets a password from the invitation email and signs in', async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const stamp = `${Date.now()}.${Math.floor(Math.random() * 1e4)}`;
  const mailbox = `e2e-invite.${stamp}`;
  const email = `${mailbox}@maildrop.cc`;
  const password = `Inv-${stamp.slice(-6)}-Aa1!`;

  const agent = apiToken('fieldAgent');
  const lands = (await (
    await request.get('/api/v1/lands?limit=50', { headers: { authorization: `Bearer ${agent}` } })
  ).json()) as { data: Array<{ id: string; status: string }> };
  const land = lands.data.find((l) => l.status === 'AVAILABLE');
  if (!land) throw new Error('No AVAILABLE parcel on this environment: the seed pool is empty.');
  const reserved = await request.post('/api/v1/lands/reservations', {
    headers: { authorization: `Bearer ${agent}` },
    data: {
      landId: land.id,
      clientName: 'E2E Invitation',
      clientEmail: email,
      clientPhone: '+237699887745',
    },
  });
  expect(reserved.status(), await reserved.text()).toBe(201);
  const reservationId = ((await reserved.json()) as { data: { id: string } }).data.id;

  try {
    // The subject of the test: the link as the email carries it.
    const link = await emailedLink(mailbox, /Définissez votre mot de passe|Set your password/);
    const landing = await page.goto(link);
    expect(landing?.status(), `the invitation link ${link.replace(/token=[^&]+/, 'token=…')}`).toBe(
      200,
    );

    await page.locator('input#password').fill(password);
    await page.locator('input#confirmPassword').fill(password);
    await authSlot('reset-password');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/login/, { timeout: 20_000 });

    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await authSlot('login');
    await page.getByRole('button', { name: /connecter|log ?in|sign ?in/i }).click();
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 20_000 });
    await expect(page).not.toHaveURL(/login/);
  } finally {
    const admin = apiToken('admin');
    await request.post(`/api/v1/lands/admin/reservations/${reservationId}/cancel`, {
      headers: { authorization: `Bearer ${admin}` },
      data: { reason: 'automated invitation-link test - returning the fixture parcel' },
    });
  }
});

test('I45 - a signed-out person confirms an email change from the link, through the login page', async ({
  page,
  request,
}) => {
  test.setTimeout(300_000);
  const stamp = `${Date.now()}.${Math.floor(Math.random() * 1e4)}`;
  const before = `e2e-mail-a.${stamp}`;
  const after = `e2e-mail-b.${stamp}`;
  const password = `Chg-${stamp.slice(-6)}-Aa1!`;

  // An ordinary verified account, minted through the API (the #79 way).
  await authSlot('register');
  const registered = await request.post('/api/v1/auth', {
    data: {
      email: `${before}@maildrop.cc`,
      password,
      firstName: 'E2E',
      lastName: 'EmailChange',
      phone: '690000001',
      language: 'fr',
    },
  });
  expect(registered.status()).toBe(201);
  const verifyLink = await emailedLink(
    before,
    /Vérifiez|Verify|Confirmez votre adresse|Confirm your email/,
  );
  const token = new URL(verifyLink).searchParams.get('token');
  await authSlot('verify-email');
  expect((await request.post('/api/v1/auth/verify-email', { data: { token } })).status()).toBe(200);

  const session = await apiLogin(request, `${before}@maildrop.cc`, password);
  const asked = await request.patch('/api/v1/users/me/email', {
    headers: { authorization: `Bearer ${session}` },
    data: { newEmail: `${after}@maildrop.cc`, currentPassword: password },
  });
  expect(asked.status(), await asked.text()).toBe(200);

  // The subject of the test: the link as the email carries it, opened signed out.
  const link = await emailedLink(
    after,
    /Confirmez votre nouvelle adresse|Confirm your new KAMBRIQ email/,
  );
  await page.goto(link);
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);

  await page.locator('input[type="email"]').fill(`${before}@maildrop.cc`);
  await page.locator('input[type="password"]').fill(password);
  await authSlot('login');
  await page.getByRole('button', { name: /connecter|log ?in|sign ?in/i }).click();

  // Back on the confirmation page, with its token, and confirmed.
  await page.waitForURL(/confirm-email-change\?token=/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/réussie|successful/i, {
    timeout: 20_000,
  });

  // Every session was revoked; the button signs out and goes to the login page,
  // where the new address works and the old one does not.
  await page.getByRole('button', { name: /Accéder à la connexion|Go to login/ }).click();
  await page.waitForURL(/\/login/, { timeout: 20_000 });
  await page.locator('input[type="email"]').fill(`${after}@maildrop.cc`);
  await page.locator('input[type="password"]').fill(password);
  await authSlot('login');
  await page.getByRole('button', { name: /connecter|log ?in|sign ?in/i }).click();
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 20_000 });

  await authSlot('login');
  const old = await request.post('/api/v1/auth/login', {
    data: { email: `${before}@maildrop.cc`, password },
  });
  // The API answers bad credentials with 400 "Email ou mot de passe invalide".
  expect(old.status()).toBe(400);
  expect(await old.text()).toMatch(/invalide|invalid/i);
});
