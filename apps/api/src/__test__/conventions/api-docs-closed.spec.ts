import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCAL_APP_ENV, servesApiDocs } from '@kambriq/common';

/**
 * A43 - the API's own documentation is served only where it is declared local.
 *
 * `main.ts` mounted Swagger whenever `NODE_ENV !== 'production'`, and the dev
 * API runs with `NODE_ENV=development`, so anybody could read every route, every
 * schema and every example on dev: `/api/v1/docs-json` answered 200 with 145
 * paths, anonymously. `NODE_ENV` says how the code was built, never which
 * environment it serves - P4 made the same correction for the robots header.
 *
 * `APP_ENV` is set nowhere today, on dev or on a laptop, so its absence cannot
 * mean "open": that would be dev. The docs are served only where `APP_ENV=local`
 * is written, and the local start scripts write it. An environment that forgot
 * to declare itself serves nothing - the safe direction to be wrong in.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8');

describe('A43 - the API documentation', () => {
  it.each([
    ['nothing declared, as on dev today', {}],
    ['dev', { APP_ENV: 'dev' }],
    ['production', { APP_ENV: 'production' }],
    ['a development build, which is also what dev runs', { NODE_ENV: 'development' }],
  ])('is not served with %s', (_what, env) => {
    expect(servesApiDocs(env as NodeJS.ProcessEnv)).toBe(false);
  });

  it('is served where the environment is declared local, however it is written', () => {
    expect(LOCAL_APP_ENV).toBe('local');
    expect(servesApiDocs({ APP_ENV: 'local' } as NodeJS.ProcessEnv)).toBe(true);
    expect(servesApiDocs({ APP_ENV: ' Local ' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('main.ts decides from servesApiDocs, and never from NODE_ENV', () => {
    const main = read('apps/api/src/main.ts');
    expect(main).toMatch(
      /if \(servesApiDocs\(process\.env\)\) \{\s*const config = new DocumentBuilder\(\)/,
    );
    // Reading it, not naming it: the comment that explains why it is not read
    // says the word, and a ban on the word would flag the explanation.
    expect(main).not.toMatch(/process\.env\.NODE_ENV|process\.env\[['"]NODE_ENV/);
  });

  it('the local start scripts declare the environment local, so a laptop keeps its Swagger', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    for (const name of ['start', 'start:dev']) {
      expect(scripts[name]).toMatch(/^APP_ENV=\$\{APP_ENV:-local\} /);
    }
    expect(scripts['start:prod']).not.toMatch(/APP_ENV/);
  });
});
