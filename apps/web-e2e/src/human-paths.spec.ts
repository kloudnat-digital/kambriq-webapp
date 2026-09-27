import { test, expect, type Page } from '@playwright/test';
import { authSlot } from './support/auth-budget';
import { emailedLink } from './support/mail';
import { ADMIN_STATE, apiToken } from './support/sessions';

/**
 * I46 - the paths a person takes, walked through the pages on every deploy:
 * registration and email verification, forgotten password, KBS enrolment, and
 * the back office taking a deposit from request to validation.
 *
 * The delivery journeys prove the same paths through the API; this file proves
 * the pages. Paths still proved only through the API, and why, are listed in
 * the register under I46. Chromium only: one browser proves a path. Auth calls
 * take a slot from the suite budget (A56).
 */
test.skip(({ browserName }) => browserName !== 'chromium', 'one browser proves a path');

/**
 * Opt-in (`RUN_PAGE_WALKS=1`) until the login budget holds in CI: on the first
 * develop run with every walk on, the API answered 429 on the login route at
 * about nine calls in sixty seconds, under a declared limit of ten (register,
 * A56 and I46).
 */
test.skip(process.env['RUN_PAGE_WALKS'] !== '1', 'opt-in: RUN_PAGE_WALKS=1');

const SIGN_IN = /connecter|log ?in|sign ?in/i;
const PDF = { name: 'proof.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 I46') };

const signIn = async (page: Page, email: string, password: string) => {
  await page.goto('/fr/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await authSlot('login');
  await page.getByRole('button', { name: SIGN_IN }).click();
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 30_000 });
};

test.describe.serial('I46 - a new person, through the pages only', () => {
  const stamp = `${Date.now()}.${Math.floor(Math.random() * 1e4)}`;
  const mailbox = `e2e-walk.${stamp}`;
  const email = `${mailbox}@maildrop.cc`;
  const first = `Walk-${stamp.slice(-6)}-Aa1!`;
  const second = `Walk2-${stamp.slice(-6)}-Aa1!`;

  test('registers on the page, verifies from the email, and signs in', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/fr/register');
    await page.locator('#firstName').fill('Walk');
    await page.locator('#lastName').fill('Person');
    await page.locator('#email').fill(email);
    await page.locator('#phone').fill('+237690000046');
    await page.locator('#password').fill(first);
    await authSlot('register');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await page.waitForURL(/\/login/, { timeout: 30_000 });

    const link = await emailedLink(mailbox, /Vérifiez votre email|Verify your KAMBRIQ email/);
    await authSlot('verify-email');
    await page.goto(link);
    await expect(page.getByRole('heading', { level: 3 })).toHaveText(/réussie|successful/i, {
      timeout: 30_000,
    });
    await page.getByRole('link', { name: /Accéder à la connexion|Go to login/ }).click();
    await page.waitForURL(/\/login/);

    await signIn(page, email, first);
    await expect(page).not.toHaveURL(/login/);
  });

  test('forgets the password on the page, resets it from the email, and signs in', async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await page.goto('/fr/forgot-password');
    await page.locator('#email').fill(email);
    await authSlot('forgot-password');
    await page.getByRole('button', { name: 'Envoyer le lien' }).click();

    const link = await emailedLink(mailbox, /Réinitialisez votre mot de passe|Reset your KAMBRIQ/);
    await page.goto(link);
    await page.locator('input#password').fill(second);
    await page.locator('input#confirmPassword').fill(second);
    await authSlot('reset-password');
    await page.getByRole('button', { name: 'Réinitialiser' }).click();
    await page.waitForURL(/\/login/, { timeout: 30_000 });

    await signIn(page, email, second);
    await expect(page).not.toHaveURL(/login/);
  });

  test('enrols in KBS on the page, with an identity document and the engagement', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await signIn(page, email, second);
    await page.goto('/fr/kbs/enroll');
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: 'cni.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 identity'),
      });
    await page.locator('#engagement').click();
    await page.getByRole('button', { name: 'Envoyer ma candidature' }).click();
    await page.waitForURL((url) => !url.pathname.endsWith('/kbs/enroll'), { timeout: 30_000 });
    await expect(page).toHaveURL(/\/kbs/);
  });
});

test('I46 - the back office takes a deposit from request to validation through its screens', async ({
  browser,
  request,
}) => {
  test.setTimeout(420_000);
  const agent = apiToken('fieldAgent');
  const admin = apiToken('admin');
  const auth = (t: string) => ({ authorization: `Bearer ${t}` });
  const stamp = `${Date.now()}.${Math.floor(Math.random() * 1e4)}`;
  const mailbox = `e2e-pay.${stamp}`;
  const email = `${mailbox}@maildrop.cc`;
  const password = `Pay-${stamp.slice(-6)}-Aa1!`;

  // Setup through the API: the agent's reservation (walked by the journeys),
  // and the invitation's password (walked by emailed-links.spec.ts).
  const lands = (await (
    await request.get('/api/v1/lands?limit=50', { headers: auth(agent) })
  ).json()) as {
    data: Array<{ id: string; status: string }>;
  };
  const land = lands.data.find((l) => l.status === 'AVAILABLE');
  if (!land) throw new Error('No AVAILABLE parcel on this environment: the seed pool is empty.');
  const reserved = await request.post('/api/v1/lands/reservations', {
    headers: auth(agent),
    data: {
      landId: land.id,
      clientName: 'I46 Walk',
      clientEmail: email,
      clientPhone: '+237699887746',
    },
  });
  expect(reserved.status(), await reserved.text()).toBe(201);
  const { id: reservationId, clientUserId } = (
    (await reserved.json()) as {
      data: { id: string; clientUserId: string };
    }
  ).data;

  try {
    const invite = await emailedLink(mailbox, /Définissez votre mot de passe|Set your password/);
    await authSlot('reset-password');
    const set = await request.post('/api/v1/auth/reset-password', {
      data: { token: new URL(invite).searchParams.get('token'), newPassword: password },
    });
    expect(set.status()).toBe(204);

    // The client asks for the deposit on their purchase page.
    const clientPage = await (await browser.newContext()).newPage();
    await signIn(clientPage, email, password);
    await clientPage.goto(`/fr/mylands/purchase/${reservationId}`);
    await clientPage.getByRole('button', { name: 'Obtenir ma référence de paiement' }).click();
    await expect(clientPage.getByText('Votre demande est enregistrée')).toBeVisible({
      timeout: 30_000,
    });

    // The identity document: through the API - a land buyer has no page to send
    // one (register, I47). The review of it is walked below.
    await authSlot('login');
    const login = await request.post('/api/v1/auth/login', { data: { email, password } });
    const client = ((await login.json()) as { data: { tokens: { accessToken: string } } }).data
      .tokens.accessToken;
    const url = (await (
      await request.post('/api/v1/users/me/id-document/upload-url', {
        headers: auth(client),
        data: { filename: 'cni.txt', contentType: 'text/plain' },
      })
    ).json()) as { data: { uploadUrl: string; fileUrl: string } };
    await fetch(url.data.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: 'id',
    });
    await request.patch('/api/v1/users/me/id-document', {
      headers: auth(client),
      data: { idDocumentUrls: [url.data.fileUrl] },
    });

    // The back office, in the administrator's session for the run.
    const office = await (await browser.newContext({ storageState: ADMIN_STATE })).newPage();
    await office.goto(`/fr/admin/identities/${clientUserId}`);
    await office.getByRole('button', { name: "Vérifier l'identité" }).click();
    await expect(office.getByRole('button', { name: "Vérifier l'identité" })).toBeHidden({
      timeout: 30_000,
    });

    const payments = (await (
      await request.get('/api/v1/lands/admin/payments?limit=100', { headers: auth(admin) })
    ).json()) as { data: Array<{ id: string; reservationId: string; amountDue: string }> };
    const payment = payments.data.find((p) => p.reservationId === reservationId);
    if (!payment) throw new Error(`no payment for reservation ${reservationId}`);

    await office.goto(`/fr/admin/payments/${payment.id}`);
    await office.getByLabel('Canal retenu').selectOption('VIR');
    await office
      .getByPlaceholder('Client bancarisé, virement convenu au téléphone')
      .fill('I46 walk');
    await office.getByRole('button', { name: 'Publier les coordonnées et notifier' }).click();

    const advance = async (to: string) => {
      await office.getByTestId('advance-reason').fill(`I46 walk: ${to}`);
      await office.getByTestId(`advance-to-${to}`).click();
      await expect(office.getByTestId(`advance-to-${to}`)).toBeHidden({ timeout: 30_000 });
    };
    await advance('ANNONCE_CLIENT');
    await advance('EN_VERIFICATION');

    await office.getByTestId('receipt-amount').fill(payment.amountDue);
    await office.getByTestId('receipt-received-at').fill(new Date().toISOString().slice(0, 10));
    await office.getByTestId('receipt-proof').setInputFiles(PDF);
    await expect(office.getByText('Justificatif téléversé.')).toBeVisible({ timeout: 30_000 });
    await office.getByTestId('record-receipt-submit').click();

    await office.getByTestId('advance-reason').fill('I46 walk: received');
    await office.getByTestId('advance-evidence').selectOption({ index: 1 });
    await office.getByTestId('advance-to-PARTIELLEMENT_RECU').click();

    await office.getByTestId('validate-evidence').selectOption({ index: 1 });
    await office.getByTestId('validate-reason').fill('I46 walk: settled');
    await office.getByTestId('validate-submit').click();
    const heading = office.locator('header').filter({ has: office.locator('h1') });
    await expect(heading).toContainText('Validé', { timeout: 30_000 });
    await expect(heading).toContainText('Acompte');
  } finally {
    await request.post(`/api/v1/lands/admin/reservations/${reservationId}/cancel`, {
      headers: auth(admin),
      data: { reason: 'automated I46 walk - returning the fixture parcel' },
    });
  }
});
