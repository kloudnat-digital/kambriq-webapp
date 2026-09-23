import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The shipped API tree compiles with `strict`.
 *
 * `tsconfig.base.json` sets neither `strict` nor `strictNullChecks`, and
 * `apps/web` and `libs/common` each set it locally. Without it in
 * `apps/api/tsconfig.app.json`, every `T | undefined` collapses to `T` and
 * optional properties are dereferenceable without a check - so a DTO field
 * declared `.optional()` in its Zod schema typechecks as always present.
 *
 * Pinned because removing the setting is a one-line edit that resolves any
 * strict error, and nothing else in the repository would report it.
 */
const TSCONFIG = join(__dirname, '..', '..', '..', 'tsconfig.app.json');

/** A declaration, not a mention: the assignment opens its own line. */
const DECLARES_STRICT = /^[ \t]*"strict"[ \t]*:[ \t]*true[ \t]*,?[ \t]*$/m;

describe('the shipped API tree compiles with strict', () => {
  const source = readFileSync(TSCONFIG, 'utf8');

  /** A guard that reads the wrong file passes for the wrong reason. */
  it('is reading apps/api/tsconfig.app.json', () => {
    expect(source).toMatch(/^[ \t]*"outDir"[ \t]*:[ \t]*"\.\.\/\.\.\/dist\/out-tsc"/m);
  });

  it('declares strict, and the typecheck script reads this file', () => {
    expect(source).toMatch(DECLARES_STRICT);
  });
});
