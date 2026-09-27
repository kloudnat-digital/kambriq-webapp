import { test, expect } from '@playwright/test';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { authLimits, takeSlot } from './support/auth-budget';

/**
 * A56 - the budget helper itself, without a browser or a network: the shared
 * window holds, and the limits are the API's own.
 */
test.describe('A56 - the auth budget', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'logic, not a browser');

  test('reads the limits from the API controller, not from a copy', () => {
    const limits = authLimits();
    expect(limits.get('login')).toEqual({ limit: 10, ttl: 60_000 });
    expect(limits.get('register')).toEqual({ limit: 10, ttl: 60_000 });
    expect(limits.get('forgot-password')).toEqual({ limit: 5, ttl: 60_000 });
  });

  test('lets the budget through, then makes the next caller wait for the window', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'budget-'));
    let clock = 1_000_000;
    const now = () => clock;
    for (let i = 0; i < 3; i++) expect(await takeSlot('k', 3, 60_000, dir, now)).toBe(0);

    // The fourth call waits until the first leaves the window.
    const waiting = takeSlot('k', 3, 200, dir, () => clock);
    clock += 260;
    expect(await waiting).toBeGreaterThanOrEqual(0);
  });

  test('never lets more than the budget into one window, across concurrent callers', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'budget-'));
    const stamps: number[] = [];
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        await takeSlot('c', 2, 400, dir);
        stamps.push(Date.now());
      }),
    );
    stamps.sort((a, b) => a - b);
    for (let i = 2; i < stamps.length; i++)
      expect(stamps[i] - stamps[i - 2]).toBeGreaterThanOrEqual(390);
  });

  /**
   * Inverted: every spec file is read, and every auth call in it - an API call
   * to an auth route, or a click on a sign-in button - must have taken a slot
   * within the three lines before it. A new test cannot forget without failing.
   */
  test('no spec calls an auth route without taking a slot first', () => {
    const AUTH_CALL =
      /request\.post\(\s*['`]\/api\/v1\/auth(?:['`]|\/(?:login|verify-email|reset-password|forgot-password|resend-verification)['`])|getByRole\('button', \{ name: \/connecter|locator\('button\[type="submit"\]'\)\.click/;
    const missing: string[] = [];
    for (const file of readdirSync(__dirname).filter((f) => /\.(spec|setup)\.ts$/.test(f))) {
      const lines = readFileSync(join(__dirname, file), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!AUTH_CALL.test(line) || file === 'auth-budget.spec.ts') return;
        const before = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
        if (!before.includes('authSlot(')) missing.push(`${file}:${i + 1}`);
      });
    }
    expect(missing).toEqual([]);
  });
});
