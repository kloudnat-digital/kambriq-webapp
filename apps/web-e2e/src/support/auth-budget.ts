import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Keeps the suite inside the API's per-caller auth rate limits (A56).
 *
 * The suite calls from one address, so it is one caller: every auth request -
 * through a page or through the API - must first take a slot here. Slots are a
 * sliding window per route, shared across workers through a lock directory,
 * at 80% of the limit the API declares in `auth.controller.ts`, which is read
 * at run time so the two cannot drift. The window is never reset: entries
 * expire after the route's TTL, as the API's own bucket does, so consecutive
 * runs stay inside the limit too.
 */
export type AuthRoute =
  | 'register'
  | 'login'
  | 'verify-email'
  | 'reset-password'
  | 'forgot-password'
  | 'resend-verification';

const CONTROLLER = join(__dirname, '../../../api/src/core/auth/auth.controller.ts');

/** `@Throttle({ default: { limit: N, ttl: T } })` above `@Post('route')`, read from the source. */
export const authLimits = (source = readFileSync(CONTROLLER, 'utf8')) => {
  const limits = new Map<string, { limit: number; ttl: number }>();
  const re =
    /@Throttle\(\{\s*default:\s*\{\s*limit:\s*(\d+),\s*ttl:\s*([\d_]+)\s*\}\s*\}\)[\s\S]*?@Post\((?:'([^']*)')?\)/g;
  for (const m of source.matchAll(re)) {
    limits.set(m[3] ?? 'register', { limit: Number(m[1]), ttl: Number(m[2].replace(/_/g, '')) });
  }
  return limits;
};

export const budgetDir = () =>
  process.env['E2E_AUTH_BUDGET_DIR'] ?? join(tmpdir(), 'kambriq-e2e-auth-budget');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const withLock = async <T>(dir: string, fn: () => T): Promise<T> => {
  const lock = join(dir, '.lock');
  for (let i = 0; ; i++) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      if (i > 2000) rmSync(lock, { recursive: true, force: true }); // a crashed holder
      await sleep(10);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
};

/**
 * Waits until `key` has fewer than `budget` calls in the last `windowMs`, then
 * records this one. Returns how long it waited, so a test can say so.
 */
export const takeSlot = async (
  key: string,
  budget: number,
  windowMs: number,
  dir = budgetDir(),
  now: () => number = Date.now,
): Promise<number> => {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${key}.json`);
  const started = now();
  for (;;) {
    const wait = await withLock(dir, () => {
      const t = now();
      const recent = (
        existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as number[]) : []
      ).filter((s) => s > t - windowMs);
      if (recent.length < budget) {
        writeFileSync(file, JSON.stringify([...recent, t]));
        return 0;
      }
      return recent[0] + windowMs - t + 50;
    });
    if (wait === 0) return now() - started;
    await sleep(wait);
  }
};

const LIMITS = authLimits();

/** Takes a slot for one call to an auth route, at 80% of the API's limit for it. */
export const authSlot = async (route: AuthRoute): Promise<number> => {
  const found = LIMITS.get(route);
  if (!found)
    throw new Error(`auth-budget: no @Throttle found for '${route}' in auth.controller.ts`);
  return takeSlot(`auth-${route}`, Math.max(1, Math.floor(found.limit * 0.8)), found.ttl);
};
