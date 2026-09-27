import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Per-role credentials shared by the whole run (A56): an API bearer token for
 * each seeded fixture role, and the administrator's browser storage state,
 * written once by `sessions.setup.ts`. The accounts are the seed's test
 * fixtures (`prisma/seed.ts`).
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
