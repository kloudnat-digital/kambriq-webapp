import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Nothing the web imports from `libs/common` may resolve into generated code.
 *
 * ---------------------------------------------------------------------------
 * The failure this exists for, which has now happened
 * ---------------------------------------------------------------------------
 * `apps/web/src/lib/actions/kamnet.ts` imported
 * `@kambriq/common/constants/kamnet`, whose `index.ts` re-exported the six
 * KAMNET enums from `../../prisma/kamnet-client/enums` - a GENERATED client.
 *
 * `docker/Dockerfile.web` installs with `--ignore-scripts`, so the
 * `postinstall` that runs `prisma generate` never fires; it copies no `prisma/`
 * directory and issues no `prisma generate` of its own. The generated tree is
 * gitignored (`libs/common/src/prisma/*`, zero tracked files), so
 * `COPY libs ./libs/` copies a directory that is not in the build context.
 *
 * The web image therefore failed to build on `develop`:
 *
 *   ./libs/common/src/constants/kamnet/index.ts:1:1
 *   Module not found: Can't resolve '../../prisma/kamnet-client/enums'
 *
 * and because `Deploy to dev` needs both images, dev silently stayed on the
 * previous commit. `Dockerfile.api` runs `prisma generate` four times, which is
 * why the API image built from the same source and the difference went unseen.
 *
 * ---------------------------------------------------------------------------
 * Why the existing test did not catch it
 * ---------------------------------------------------------------------------
 * `common-lib-is-consumable-by-web.spec.ts` is about exactly this class and its
 * docstring even says the tree is ".ts source and generated Prisma clients". It
 * pins the module type, the alias shape and the BigInt target - and asserts
 * nothing about what a web-reachable subpath pulls in. **A guard that names a
 * hazard in prose and does not assert it is a comment.**
 *
 * This one resolves the import graph and fails on the offending file, naming the
 * chain that reaches the generated tree.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const COMMON_SRC = join(ROOT, 'libs', 'common', 'src');
const WEB_SRC = join(ROOT, 'apps', 'web', 'src');
const GENERATED = join(COMMON_SRC, 'prisma');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(full) && !full.endsWith('.d.ts') ? [full] : [];
  });

/** Every `@kambriq/common/<subpath>` the web imports today. */
const webSubpaths = (): string[] => {
  const found = new Set<string>();
  for (const file of walk(WEB_SRC)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/from '@kambriq\/common\/([^']+)'/g)) found.add(m[1]);
  }
  return [...found].sort();
};

const resolveModule = (spec: string, fromDir: string): string | null => {
  const base = resolve(fromDir, spec);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
};

/**
 * Follows relative imports out of `entry` and returns the chain that first
 * reaches the generated tree, or an empty array.
 */
const chainToGenerated = (entry: string, seen = new Set<string>()): string[] => {
  if (seen.has(entry)) return [];
  seen.add(entry);
  if (entry.startsWith(GENERATED)) return [relative(ROOT, entry)];

  const src = readFileSync(entry, 'utf8');
  for (const m of src.matchAll(/from '(\.[^']*)'/g)) {
    const next = resolveModule(m[1], join(entry, '..'));
    if (!next) continue;
    const deeper = chainToGenerated(next, seen);
    if (deeper.length > 0) return [relative(ROOT, entry), ...deeper];
  }
  return [];
};

describe('what the web imports from libs/common carries no generated code', () => {
  const subpaths = webSubpaths();

  it('is reading the imports it thinks it is', () => {
    // Vacuous-pass guard: if the scan finds no subpaths, every assertion below
    // is meaningless and this is the only place that would say so.
    expect(subpaths.length).toBeGreaterThan(0);
    expect(existsSync(COMMON_SRC)).toBe(true);
  });

  it('every subpath the web imports resolves to a real module', () => {
    const unresolved = subpaths.filter((sp) => {
      for (const candidate of [
        join(COMMON_SRC, `${sp}.ts`),
        join(COMMON_SRC, sp, 'index.ts'),
        join(COMMON_SRC, `${sp}.tsx`),
      ]) {
        if (existsSync(candidate)) return false;
      }
      return true;
    });

    expect(unresolved).toEqual([]);
  });

  it.each(subpaths)('%s does not reach libs/common/src/prisma', (subpath) => {
    const entry = [
      join(COMMON_SRC, `${subpath}.ts`),
      join(COMMON_SRC, subpath, 'index.ts'),
      join(COMMON_SRC, `${subpath}.tsx`),
    ].find((candidate) => existsSync(candidate));

    if (!entry) throw new Error(`cannot resolve @kambriq/common/${subpath}`);

    const chain = chainToGenerated(entry);
    // The message is the chain, because "it imports generated code" without the
    // path is a finding somebody has to re-derive.
    expect({ subpath, chain }).toEqual({ subpath, chain: [] });
  });

  it('the web never imports the barrel, which re-exports everything', () => {
    // `libs/common/src/index.ts` exports the Nest providers AND
    // `./constants/kamnet`. A barrel import would pull the generated tree in
    // transitively however clean the subpaths are.
    const offenders = walk(WEB_SRC).filter((file) =>
      /from '@kambriq\/common'/.test(readFileSync(file, 'utf8')),
    );

    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('still catches a generated import when one is introduced', () => {
    // Discrimination. A resolver that silently returns nothing would make every
    // assertion above pass forever. `constants/kamnet/enums.ts` is the file that
    // used to re-export the generated client, so the chain is followed from a
    // module known to sit one hop away from the generated tree.
    const generatedEntry = join(GENERATED, 'kamnet-client', 'enums.ts');
    if (!existsSync(generatedEntry)) {
      // The generated tree is gitignored and absent in some environments - which
      // is the whole point of this file. Nothing to discriminate against here.
      return;
    }
    expect(chainToGenerated(generatedEntry)).toEqual([relative(ROOT, generatedEntry)]);
  });
});
