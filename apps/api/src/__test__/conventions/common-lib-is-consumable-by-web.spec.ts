import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `libs/common` is shared source, and the web compiles it too.
 *
 * G4 is the first web code to import from `libs/`, and it does so because money
 * must be rendered by ONE function: `formatMoney` cannot have a second copy on
 * the browser side without the two drifting.
 *
 * `libs/common/package.json` used to declare `"type": "commonjs"`. Turbopack
 * takes that as the module format for every file beneath it, and the ESM
 * `export const` in `payment-format.ts` then fails the build with:
 *
 *   Specified module format (CommonJs) is not matching the module format of the
 *   source code (EcmaScript Modules)
 *
 * The API never noticed - it compiles the same files through tsc. `nx typecheck`
 * passed, every unit test was green, and `/admin/payments` returned 500.
 *
 * Removing the field changes nothing for Node: an absent `type` already means
 * CommonJS, and there is not a single `.js` file under `libs/common/src` for it
 * to govern - the tree is `.ts` source and generated Prisma clients that are
 * also `.ts`. It was a declaration about files that do not exist. Proven by
 * running both source-run scripts under tsx after removing it: `prisma/seed.ts`
 * completed, `prisma/bootstrap-admins.ts` reached its SSM read.
 *
 * Pinned because re-adding it is the kind of edit that looks like completing a
 * package manifest, and the thing it breaks is a screen, in a different app,
 * with an error that names neither.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const PKG_PATH = join(ROOT, 'libs', 'common', 'package.json');
const PKG = JSON.parse(readFileSync(PKG_PATH, 'utf8'));

describe('libs/common stays consumable by the web build', () => {
  it('is reading the manifest it thinks it is', () => {
    expect(PKG.name).toBe('@kambriq/common');
  });

  it('does not declare a CommonJS module type', () => {
    expect(PKG.type).toBeUndefined();
  });

  it('has no .js files for a module type to have governed', () => {
    // If this ever stops being true, the reasoning above needs revisiting
    // rather than the assertion above being deleted.
    const src = join(ROOT, 'libs', 'common', 'src');
    const walk = (dir: string): string[] => {
      const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
      return readdirSync(dir).flatMap((e) => {
        const full = join(dir, e);
        return statSync(full).isDirectory() ? walk(full) : full.endsWith('.js') ? [full] : [];
      });
    };
    expect(walk(src)).toEqual([]);
  });

  it('the web maps the deep alias only, never the barrel', () => {
    // The barrel re-exports Nest providers. Importing it from a client component
    // pulls the Nest runtime into the browser bundle.
    const webTsconfig = readFileSync(join(ROOT, 'apps', 'web', 'tsconfig.json'), 'utf8');
    expect(webTsconfig).toContain('"@kambriq/common/*"');
    expect(webTsconfig).not.toContain('"@kambriq/common":');
  });

  it('the web targets a version that has BigInt literals', () => {
    // Money is BigInt here, and the shared state machine writes `0n`. On the
    // base target (es2015) the web build fails with TS2737, and the workaround
    // would be to write `BigInt(0)` in shared money code to please a browser
    // target the API does not have.
    const webTsconfig = JSON.parse(
      readFileSync(join(ROOT, 'apps', 'web', 'tsconfig.json'), 'utf8').replace(/^\s*\/\/.*$/gm, ''),
    );
    const target = String(webTsconfig.compilerOptions.target).toLowerCase();
    expect(Number(target.replace('es', ''))).toBeGreaterThanOrEqual(2020);
  });

  it('the manifest exists where both apps expect it', () => {
    expect(existsSync(PKG_PATH)).toBe(true);
  });
});
