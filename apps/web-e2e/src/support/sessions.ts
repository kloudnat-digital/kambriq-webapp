import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A56 - one sign-in per role per run, reused by every test.
 *
 * `sessions.setup.ts` signs in once for each seeded test role and writes what
 * the tests reuse here: an API bearer token per role, and the administrator's
 * browser session (Playwright storage state). The accounts are the seed's own
 * fixtures (`prisma/seed.ts`) - test accounts on dev, never a real person's.
 */
export const SESSIONS_DIR = join(__dirname, '../../../../dist/.playwright/apps/web-e2e/.sessions');
export const ADMIN_STATE = join(SESSIONS_DIR, 'admin.json');
const TOKENS = join(SESSIONS_DIR, 'api-tokens.json');

export const FIXTURES = {
  admin: 'admin@kambriq.com',
  fieldAgent: 'eric.mbou@kambriq.com',
} as const;
export type Role = keyof typeof FIXTURES;

/** The seed's fixture password, read from the environment the suite runs with. */
export const fixturePassword = () => process.env['E2E_FIXTURE_PASSWORD'] ?? 'Test1234!';

export const tokensFile = () => TOKENS;

export const apiToken = (role: Role): string => {
  const tokens = JSON.parse(readFileSync(TOKENS, 'utf8')) as Record<Role, string>;
  const token = tokens[role];
  if (!token) throw new Error(`sessions: no API token for ${role} - did sessions.setup.ts run?`);
  return token;
};
