import { test as setup, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { authSlot } from './support/auth-budget';
import {
  ADMIN_STATE,
  FIXTURES,
  SESSIONS_DIR,
  fixturePassword,
  tokensFile,
} from './support/sessions';

/**
 * A56 - sign in once per role, before any test, and hand the result to all of
 * them. Three sign-ins for the whole run instead of one per test that needs a
 * role.
 */
setup('sign in once per role', async ({ page, request }) => {
  setup.setTimeout(180_000);
  mkdirSync(SESSIONS_DIR, { recursive: true });

  const tokens: Record<string, string> = {};
  for (const [role, email] of Object.entries(FIXTURES)) {
    await authSlot('login');
    const res = await request.post('/api/v1/auth/login', {
      data: { email, password: fixturePassword() },
    });
    expect(res.status(), `API sign-in for the ${role} fixture`).toBe(200);
    tokens[role] = (
      (await res.json()) as { data: { tokens: { accessToken: string } } }
    ).data.tokens.accessToken;
  }
  writeFileSync(tokensFile(), JSON.stringify(tokens));

  // The administrator's browser session, for the back-office walks.
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(FIXTURES.admin);
  await page.locator('input[type="password"]').fill(fixturePassword());
  await authSlot('login');
  await page.getByRole('button', { name: /connecter|log ?in|sign ?in/i }).click();
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 30_000 });
  await page.context().storageState({ path: ADMIN_STATE });
});
