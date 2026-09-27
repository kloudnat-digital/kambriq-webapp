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

/**
 * I18 - the web and the e2e suite are scanned too.
 *
 * This looked at `apps/api`, `libs/common` and `prisma` only, while every role
 * check the web makes - the proxy's gates, the nav, the layouts - was written as
 * a bare string. A check that does not look at half the repository reads as
 * covered and is not.
 */
const SEARCHED = ['apps/api/src', 'libs/common/src', 'prisma', 'apps/web/src', 'apps/web-e2e/src'];

/**
 * The enum has to write the strings once; that is its whole job. Nothing else is
 * exempt — not the seed, not a DTO example, not a comment quoting the old bug.
 */
const ALLOWED = ['libs/common/src/types/roles.enum.ts'];

/**
 * Literals spelled like a role code that are not one, each exempt in exactly
 * one file and with its reason. The last test fails when one stops matching, so
 * an exemption cannot outlive what it excuses.
 */
const NOT_A_ROLE: ReadonlyArray<{ file: string; literal: string; why: string }> = [
  {
    file: 'apps/web/src/hooks/use-breadcrumbs.ts',
    literal: "'agent'",
    why: 'the /agent URL segment, mapped to its breadcrumb translation key',
  },
  {
    file: 'apps/web/src/components/reservations/reservation-card.tsx',
    literal: "'client'",
    why: "a translation key, t('client')",
  },
  {
    file: 'apps/web/src/components/reservations/reservation-client-info-card.tsx',
    literal: "'client'",
    why: "a translation key, t('client')",
  },
];

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

/**
 * Unit tests stay exempt: they hand literal role arrays to the function under
 * test on purpose. The e2e suite is not a unit test - its specs are the code
 * that drives the deployed app - so it is scanned whole.
 */
const isUnitTest = (f: string): boolean =>
  !f.startsWith('apps/web-e2e/') && (f.includes('__test__') || /\.spec\.tsx?$/.test(f));

const FILES = SEARCHED.flatMap((d) => walk(join(ROOT, d)))
  .map((f) => relative(ROOT, f))
  .filter((f) => !ALLOWED.includes(f))
  .filter((f) => !isUnitTest(f));

/** A file's source with comments, and its own exempt literals, removed. */
const scanned = (f: string): string =>
  NOT_A_ROLE.filter((e) => e.file === f).reduce(
    (src, e) => src.split(e.literal).join(''),
    stripComments(readFileSync(join(ROOT, f), 'utf8')),
  );

describe('role codes are never bare strings', () => {
  it('is looking at the source tree at all', () => {
    // A scanner that finds no files would make every assertion below vacuous:
    // the measurement failing silently rather than the thing measured.
    expect(FILES.length).toBeGreaterThan(50);
    expect(FILES).toContain('apps/api/src/core/users/users.service.ts');
    expect(FILES).toContain('prisma/seed.ts');
    expect(FILES).toContain('apps/web/src/routes.ts');
    expect(FILES.some((f) => f.startsWith('apps/web-e2e/'))).toBe(true);
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

    const offenders = FILES.filter((f) => pattern.test(scanned(f)));

    expect(offenders).toEqual([]);
  });

  it.each(NOT_A_ROLE.map((e) => [e.file, e.literal] as const))(
    'the exemption for %s %s still matches something',
    (file, literal) => {
      expect(FILES).toContain(file);
      expect(stripComments(readFileSync(join(ROOT, file), 'utf8'))).toContain(literal);
    },
  );
});
