import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

import { RoleCode } from '@kambriq/common';

/**
 * No role code may be written as a bare string. Anywhere.
 *
 * `findOrCreateClientUser` read `where: { code: 'client' }` while the stored
 * code is `'CLIENT'`. Postgres comparison is case-sensitive, the lookup returned
 * `null`, and an `if (clientRole)` swallowed it — so a client created by a land
 * reservation got **no roles at all**. `@Roles(RoleCode.CLIENT)` gates the whole
 * client portal: the reservation returned 201, the portal-access email sent, the
 * job was green, and the only symptom was a person who could not get into the
 * thing they had just been invited to.
 *
 * **The casing was how it surfaced. The literal was the defect.** The
 * registration path a few files away is correct today only by the accident of
 * having spelled the constant, and accidents do not survive the next person in
 * the file. `RoleCode.CLIENT` cannot be miscased: TypeScript rejects
 * `RoleCode.Client` and no database lookup is needed to find out.
 *
 * This is enforced as a test rather than an ESLint rule on purpose. CI runs
 * `nx lint api` only, so a lint rule covering `libs/common` and `prisma/` would
 * not actually run — and an enforcement that does not run is worse than none,
 * because it reads as covered.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');

const SEARCHED = ['apps/api/src', 'libs/common/src', 'prisma'];

/**
 * The enum has to write the strings once; that is its whole job. Nothing else is
 * exempt — not the seed, not a DTO example, not a comment quoting the old bug.
 */
const ALLOWED = ['libs/common/src/types/roles.enum.ts'];

const CODES = Object.values(RoleCode);

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'migrations') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (['.ts', '.tsx'].includes(extname(entry))) out.push(full);
  }
  return out;
};

/** Strips comments, so prose quoting the old defect is not a violation. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const FILES = SEARCHED.flatMap((d) => walk(join(ROOT, d)))
  .map((f) => relative(ROOT, f))
  .filter((f) => !ALLOWED.includes(f))
  .filter((f) => !f.includes('__test__') && !f.endsWith('.spec.ts'));

describe('role codes are never bare strings', () => {
  it('is looking at the source tree at all', () => {
    // A scanner that finds no files would make every assertion below vacuous:
    // the measurement failing silently rather than the thing measured.
    expect(FILES.length).toBeGreaterThan(50);
    expect(FILES).toContain('apps/api/src/core/users/users.service.ts');
    expect(FILES).toContain('prisma/seed.ts');
  });

  it('knows what the role codes are', () => {
    expect(CODES.length).toBeGreaterThan(5);
    expect(CODES).toContain('CLIENT');
  });

  it.each(CODES)('no file writes %s as a string literal', (code) => {
    // Both cases: 'CLIENT' is the right value written the wrong way, and
    // 'client' is how this defect actually appeared.
    //
    // The quotes are back-referenced so the match is a COMPLETE quoted string.
    // The first version used `['"`]…['"`]` and flagged the French question bank:
    // in `"Il a changé d'agent"` the apostrophe opened a match that the closing
    // double quote finished. That was a defect in the measurement, found by the
    // measurement, and it is left recorded here rather than tidied away.
    const pattern = new RegExp(`(['"\`])(${code}|${code.toLowerCase()})\\1`);

    const offenders = FILES.filter((f) =>
      pattern.test(stripComments(readFileSync(join(ROOT, f), 'utf8'))),
    );

    expect(offenders).toEqual([]);
  });
});
