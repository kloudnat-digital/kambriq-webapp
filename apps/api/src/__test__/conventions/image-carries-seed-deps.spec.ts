import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The image must carry every tree the source-run scripts resolve imports against.
 *
 * `prisma/seed.ts` runs from SOURCE under `tsx`, inside the production image.
 * The Dockerfile used to copy only `libs/common/src/prisma` and
 * `libs/common/src/i18n` — everything the compiled API needs, because
 * `dist/apps/api/main.js` has the rest bundled. The moment the seed imported
 * `libs/common/src/types/roles.enum` it died in the container with
 * `Cannot find module`, having run clean locally minutes earlier.
 *
 * **A green local run says nothing about a tree the image does not carry.**
 *
 * This test does not try to resolve imports — it holds the decision that made
 * the class go away: copy the directory, not a list of its children.
 *
 * `prisma/bootstrap-admins.ts` is here for the same reason and by the same
 * mechanism: it runs from source under `tsx`, in the same image, and it imports
 * `libs/common/src/types/role-hierarchy`. The hierarchy was extracted out of
 * `roles.guard.ts` partly so that this import pulls in the enum and nothing
 * else — the guard would have dragged `@nestjs/core` into a CLI script, and the
 * first place that would have shown up is the container.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const DOCKERFILE = readFileSync(join(ROOT, 'docker', 'Dockerfile.api'), 'utf8');
const SEED = readFileSync(join(ROOT, 'prisma', 'seed.ts'), 'utf8');
const BOOTSTRAP = readFileSync(join(ROOT, 'prisma', 'bootstrap-admins.ts'), 'utf8');

/** The scripts that run from SOURCE inside the production image, under tsx. */
const SOURCE_RUN: ReadonlyArray<readonly [string, string]> = [
  ['prisma/seed.ts', SEED],
  ['prisma/bootstrap-admins.ts', BOOTSTRAP],
];

describe('the api image carries what the source-run scripts need', () => {
  it('is reading the files it thinks it is', () => {
    expect(DOCKERFILE).toContain('FROM node:');
    expect(SEED).toContain('Kambriq seed starting');
    expect(BOOTSTRAP).toContain('Kambriq super-admin bootstrap starting');
  });

  it('copies the whole of libs/common/src, not chosen subdirectories', () => {
    expect(DOCKERFILE).toContain('COPY --from=builder /app/libs/common/src ./libs/common/src');
    // The narrow copies are what broke; they must not come back.
    expect(DOCKERFILE).not.toContain('/app/libs/common/src/prisma ./libs/common/src/prisma');
    expect(DOCKERFILE).not.toContain('/app/libs/common/src/i18n ./libs/common/src/i18n');
  });

  it('copies prisma/, which is where the seed and its data live', () => {
    expect(DOCKERFILE).toContain('COPY --from=builder /app/prisma ./prisma/');
  });

  it.each(SOURCE_RUN)(
    'every libs/ path %s imports sits under a directory the image copies',
    (_name, src) => {
      const imported = [...src.matchAll(/from '(\.\.\/libs\/[^']+)'/g)].map((m) => m[1]);
      // A sweep that finds no imports would make this vacuous.
      expect(imported.length).toBeGreaterThan(0);
      for (const path of imported) {
        expect(path.startsWith('../libs/common/src/')).toBe(true);
      }
    },
  );

  it('the bootstrap dependency is a production dependency, so --prod install keeps it', () => {
    // The production stage runs `pnpm install --frozen-lockfile --prod`. A
    // devDependency here would resolve locally, pass every test, and be absent
    // from the only place the script actually has to run.
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(BOOTSTRAP).toContain("from '@aws-sdk/client-ssm'");
    expect(Object.keys(pkg.dependencies)).toContain('@aws-sdk/client-ssm');
    expect(Object.keys(pkg.dependencies)).toContain('tsx');
  });
});
