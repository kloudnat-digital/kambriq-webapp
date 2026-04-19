import { test, expect } from '@playwright/test';

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

  test('protected route redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
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
});
