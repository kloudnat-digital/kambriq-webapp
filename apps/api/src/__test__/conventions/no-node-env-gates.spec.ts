import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * A48 - no behaviour in the API is decided on `NODE_ENV`.
 *
 * `NODE_ENV` says how the code was built. The dev image runs
 * `NODE_ENV=development`, exactly like a laptop, so every decision taken on it
 * treated a deployed environment as a developer's machine. Third time: the
 * robots header (P4), the Swagger documentation (A43), and then everything this
 * pass converted - Prisma logged every SQL statement on dev, and pino logged at
 * debug level with pretty-printing. Decisions read `APP_ENV`, through
 * `libs/common/src/config/app-env.ts`.
 *
 * So the API and the shared library may READ `NODE_ENV` only in the files
 * declared below, each with its reason. A mention in a comment is not a read:
 * comments are stripped first, or the explanation of the rule would trip it.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SEARCHED = ['apps/api/src', 'libs/common/src'];

/** Files that may read NODE_ENV, because they report or declare it and decide nothing. */
const MAY_READ_NODE_ENV: Record<string, string> = {
  'apps/api/src/health/build-info.ts':
    'reports how the image was built, beside `appEnv` which says where it runs - decides nothing',
};

const READ =
  /process\.env\.NODE_ENV\b|process\.env\[\s*['"`]NODE_ENV['"`]\s*\]|\.get(?:<[^>]*>)?\(\s*['"`]NODE_ENV['"`]/g;

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

const SOURCES = SEARCHED.flatMap((d) => walk(join(ROOT, d)))
  .filter((f) => f.endsWith('.ts'))
  .filter((f) => !/\.(spec|dbspec)\.ts$/.test(f) && !f.includes('/__test__/'))
  .filter((f) => !f.includes('/prisma/') || !f.includes('-client/'))
  .map((f) => relative(ROOT, f));

const reads = (f: string) => stripComments(readFileSync(join(ROOT, f), 'utf8')).match(READ) ?? [];

describe('A48 - behaviour is decided on APP_ENV, never on NODE_ENV', () => {
  it('recognises every form a read takes, and not a mention', () => {
    const src = [
      "if (process.env.NODE_ENV === 'development') {}",
      "const a = process.env['NODE_ENV'];",
      "config.get('NODE_ENV') === 'production'",
      "config.get<string>('NODE_ENV')",
      '// process.env.NODE_ENV is not read here',
      '/* config.get("NODE_ENV") */',
      "const note = 'NODE_ENV says how the code was built';",
    ].join('\n');
    expect(stripComments(src).match(READ)).toHaveLength(4);
  });

  it('searches the whole API and the shared library', () => {
    expect(SOURCES.length).toBeGreaterThan(120);
    expect(SOURCES).toContain('apps/api/src/main.ts');
  });

  it('no file outside the declared ones reads NODE_ENV', () => {
    const found = SOURCES.filter((f) => !(f in MAY_READ_NODE_ENV) && reads(f).length > 0);
    expect(found).toEqual([]);
  });

  it('every declared file still reads it - an exemption that is not used is removed', () => {
    expect(Object.keys(MAY_READ_NODE_ENV).filter((f) => reads(f).length === 0)).toEqual([]);
  });
});
