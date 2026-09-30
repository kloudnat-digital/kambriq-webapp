import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * C40 - every door that accepts or renews a session calls `assertHoldsSession`
 * and carries no copy of its checks. Three copies of one rule diverged once
 * (C39: sign-in refused an unverified address, the strategy and refresh did not).
 */
const AUTH = join(__dirname, '..', '..', '..', 'core', 'auth');
const read = (file: string) => readFileSync(join(AUTH, file), 'utf8');

/** The body of `async <name>(` up to the next method at the same indentation. */
const method = (src: string, name: string): string => {
  const start = src.indexOf(`  async ${name}(`);
  if (start < 0) throw new Error(`method ${name} not found`);
  const next = src.slice(start + 1).search(/\n {2}(?:async |private |public |\/\/ -----)/);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
};

const STANDING_READS = /\.(isActive|deactivatedBy|deletedAt|lockedUntil|emailVerified)\b/;

const DOORS: [string, string][] = [
  ['JwtStrategy.validate', method(read('strategies/jwt.strategy.ts'), 'validate')],
  ['AuthService.refreshTokens', method(read('auth.service.ts'), 'refreshTokens')],
];

describe('C40 - one account rule for every session', () => {
  it.each(DOORS)('%s calls the shared rule', (_door, body) => {
    expect(body).toMatch(/assertHoldsSession\(/);
  });

  it.each(DOORS)('%s reads no standing field itself', (_door, body) => {
    expect(body.match(STANDING_READS)?.[0] ?? null).toBeNull();
  });

  it('reads the methods it is about, not an empty string', () => {
    for (const [, body] of DOORS) expect(body.length).toBeGreaterThan(200);
  });
});
