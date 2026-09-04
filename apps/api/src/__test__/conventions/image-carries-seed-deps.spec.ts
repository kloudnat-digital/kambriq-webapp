import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The image must carry every tree the seed resolves imports against.
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
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const DOCKERFILE = readFileSync(join(ROOT, 'docker', 'Dockerfile.api'), 'utf8');
const SEED = readFileSync(join(ROOT, 'prisma', 'seed.ts'), 'utf8');

describe('the api image carries what the seed needs', () => {
  it('is reading the files it thinks it is', () => {
    expect(DOCKERFILE).toContain('FROM node:');
    expect(SEED).toContain('Kambriq seed starting');
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

  it('every libs/ path the seed imports sits under a directory the image copies', () => {
    const imported = [...SEED.matchAll(/from '(\.\.\/libs\/[^']+)'/g)].map((m) => m[1]);
    // A sweep that finds no imports would make this vacuous.
    expect(imported.length).toBeGreaterThan(0);
    for (const path of imported) {
      expect(path.startsWith('../libs/common/src/')).toBe(true);
    }
  });
});
