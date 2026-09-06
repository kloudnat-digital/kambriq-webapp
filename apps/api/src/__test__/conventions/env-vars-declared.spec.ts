import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { envSchema } from '@kambriq/common';

/**
 * Every environment variable the API reads must be declared in `envSchema`.
 *
 * `validateEnv` exits the process on a bad value, which reads as though the
 * environment is checked. It only checks what the schema names. Five variables
 * were read through `config.get(key, default)` and declared nowhere:
 * `FRONTEND_URL`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `AWS_S3_BUCKET` and
 * `AWS_S3_REGION`. Each had a fallback, so a missing or misspelled one produced
 * no error at all - just the default, quietly.
 *
 * `FRONTEND_URL` is the one that matters. It builds every link in every
 * transactional email and falls back to `http://localhost:3001`. Wrong, it sends
 * working mail containing dead links, and journey 1 cannot see it: the regex
 * matches the path and the token, never the host. **A default is not a
 * declaration** - it is the thing that stops you finding out.
 *
 * The check lives here rather than in `env.validation.ts` for the same reason
 * `role-code-literals.spec.ts` does: it has to look at call sites across two
 * trees, and CI runs `nx lint api` only, so a lint rule covering `libs/common`
 * would not actually run. An enforcement that does not run is worse than none,
 * because it reads as covered.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');

const SEARCHED = ['apps/api/src', 'libs/common/src'];

/**
 * `libs/common/src/prisma` is generated Prisma client code, gitignored and
 * rewritten by `prisma generate`. Its doc comments mention `process.env.DATABASE_URL`,
 * which is neither our code nor a variable this API reads.
 */
const SKIPPED_DIRS = ['__test__', join('libs', 'common', 'src', 'prisma')];

/**
 * Build metadata, not runtime configuration.
 *
 * These are baked into the image as Docker build args by `ci.yml` and read once
 * by `health/build-info.ts`, which falls back to 'unknown' on purpose so a
 * locally built image still answers. They are properties of the image rather
 * than of the environment, so `envSchema` is deliberately not their home.
 */
const BUILD_METADATA = new Set(['APP_VERSION', 'BUILD_TIME', 'GIT_REF', 'GIT_SHA', 'IMAGE_TAG']);

/** Escape hatch for a deliberate one-off, read by `prisma/run-migrations.js`. */
const OPERATIONAL = new Set(['ALLOW_DB_PUSH']);

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (SKIPPED_DIRS.some((s) => full.includes(s + sep) || full.endsWith(s))) continue;
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
};

/** Comments mention variables they do not read. Strip them before matching. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Both ways this codebase reads configuration:
 *   `config.get<string>('KEY', 'default')`, including across a line break
 *   `process.env.KEY` and `process.env['KEY']`
 */
const KEY_PATTERNS = [
  /\bconfig(?:Service)?\s*\.\s*get\s*(?:<[^>]*>)?\s*\(\s*'([A-Z][A-Z0-9_]*)'/g,
  /\bprocess\s*\.\s*env\s*\.\s*([A-Z][A-Z0-9_]*)/g,
  /\bprocess\s*\.\s*env\s*\[\s*'([A-Z][A-Z0-9_]*)'\s*\]/g,
];

const FILES = SEARCHED.flatMap((d) => walk(join(ROOT, d))).map((f) => ({
  path: relative(ROOT, f),
  src: stripComments(readFileSync(f, 'utf8')),
}));

const readKeys = new Map<string, string[]>();
for (const { path, src } of FILES) {
  for (const pattern of KEY_PATTERNS) {
    for (const match of src.matchAll(pattern)) {
      const key = match[1];
      if (BUILD_METADATA.has(key) || OPERATIONAL.has(key)) continue;
      readKeys.set(key, [...(readKeys.get(key) ?? []), path]);
    }
  }
}

const DECLARED = new Set(Object.keys(envSchema.shape));

describe('every environment variable read is declared', () => {
  /**
   * A scanner that finds nothing makes every assertion below vacuous. This is
   * the failure mode that let a route scanner report a real route as missing
   * and a probe read its own invented 404 as a missing guard.
   */
  it('is actually reading the source tree', () => {
    expect(FILES.length).toBeGreaterThan(50);
    expect(FILES.map((f) => f.path)).toContain(
      join('apps', 'api', 'src', 'core', 'auth', 'auth.service.ts'),
    );
  });

  it('found configuration reads, including the multi-line form', () => {
    expect(readKeys.size).toBeGreaterThanOrEqual(15);
    // Single-line `config.get<string>('JWT_SECRET')`.
    expect([...readKeys.keys()]).toContain('JWT_SECRET');
    // Read as `config.get<string>(\n  'AWS_SES_CONTACT_LIST_NAME',` in
    // newsletter.service.ts - a line-anchored regex misses this one.
    expect([...readKeys.keys()]).toContain('AWS_SES_CONTACT_LIST_NAME');
    // Read as bare `process.env.CORS_ORIGINS` in main.ts.
    expect([...readKeys.keys()]).toContain('CORS_ORIGINS');
  });

  it('declares the schema keys it is checking against', () => {
    expect(DECLARED.size).toBeGreaterThanOrEqual(20);
    expect(DECLARED).toContain('FRONTEND_URL');
  });

  it('has no variable read from a source that envSchema does not declare', () => {
    const undeclared = [...readKeys.entries()]
      .filter(([key]) => !DECLARED.has(key))
      .map(([key, paths]) => `${key} (read in ${[...new Set(paths)].join(', ')})`);

    expect(undeclared).toEqual([]);
  });
});
