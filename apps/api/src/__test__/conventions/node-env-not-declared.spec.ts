import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `NODE_ENV` must not be declared in an env file.
 *
 * The tooling owns it: `next build` sets production, `next dev` sets
 * development, Jest sets test. Nx loads the workspace-root env file into every
 * target's environment, so a line here overrides all three at once.
 *
 * It cost a day. `NODE_ENV=development` in the root `.env` made `nx build web`
 * prerender with a development React build against react-dom's production
 * internals, and the build died on `Cannot read properties of null (reading
 * 'useContext')` with every stack frame ignore-listed. The same `next build`
 * run from `apps/web` passed, because it never reads the root file.
 *
 * Nothing else could catch it: CI has no root `.env` and `docker/Dockerfile.web`
 * sets `NODE_ENV` itself, so the failure exists only on a developer's machine.
 *
 * `envSchema` defaults it to 'development', so an unset value is the working one.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');

/** A declaration, not a mention: the assignment has to open its own line. */
const DECLARES_NODE_ENV = /^[ \t]*NODE_ENV[ \t]*=/m;

const read = (name: string) => {
  const path = join(ROOT, name);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
};

describe('NODE_ENV is not declared in an env file', () => {
  /**
   * A guard that reads nothing passes for the wrong reason. `.env.example` is
   * tracked, so it is present everywhere this suite runs.
   */
  it('is actually reading .env.example', () => {
    const example = read('.env.example');
    expect(example).not.toBeNull();
    expect(example).toMatch(/^[ \t]*PORT[ \t]*=/m);
  });

  it('does not declare NODE_ENV in .env.example', () => {
    expect(read('.env.example')).not.toMatch(DECLARES_NODE_ENV);
  });

  /**
   * `.env` is untracked, so this runs on a developer's machine and is skipped in
   * CI. That is the right way round: the machine holding the file is the only
   * one the file can break.
   */
  it('does not declare NODE_ENV in .env, when a local .env exists', () => {
    const local = read('.env');
    if (local === null) return;
    expect(local).not.toMatch(DECLARES_NODE_ENV);
  });
});
