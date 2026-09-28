import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * A69 - one module talks to maildrop's API, so there is one retry to keep right.
 *
 * The journeys' reader waits out a maildrop outage (#265). The browser suite had
 * two readers of its own with no retry, and one of them failed on a third party
 * three times. Every e2e reader goes through `inbox` and `message` in
 * `apps/api-e2e/src/journeys/support.ts`; a second client of the API fails here.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const THE_CLIENT = 'apps/api-e2e/src/journeys/support.ts';
const THIS_FILE = relative(ROOT, __filename);

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    ['node_modules', 'dist', '.next'].includes(e.name)
      ? []
      : e.isDirectory()
        ? walk(join(dir, e.name))
        : [join(dir, e.name)],
  );

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const CALLERS = ['apps', 'libs']
  .flatMap((d) => walk(join(ROOT, d)))
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => relative(ROOT, f))
  .filter((f) => f !== THIS_FILE)
  .filter((f) => stripComments(readFileSync(join(ROOT, f), 'utf8')).includes('api.maildrop.cc'));

describe('A69 - one client of the maildrop API', () => {
  it('is the journeys reader, and nothing else', () => {
    expect(CALLERS).toEqual([THE_CLIENT]);
  });
});
