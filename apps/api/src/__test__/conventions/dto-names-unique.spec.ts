import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * No two DTO classes share a name (A15, G4 follow-up).
 *
 * nestjs-zod registers every DTO in the OpenAPI document by class name. Two
 * `GetUploadUrlDto` - one for lands, one for KBS - collided there: the second
 * silently overwrote the first, one endpoint documented the other's body, and
 * the API printed "Duplicate DTO detected" on every boot, which is a warning
 * nobody reads by the third boot. #119 renamed them; nothing kept it so.
 *
 * Every non-test source file is read - no list of modules to forget one from.
 */
const ROOT = join(__dirname, '../../../../..');
const ROOTS = ['apps/api/src', 'libs/common/src'];
const DTO = /export class (\w+Dto)\b/g;

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      return ['node_modules', '__test__'].includes(e.name) || p.endsWith(join('src', 'prisma'))
        ? []
        : walk(p);
    }
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [p] : [];
  });

export const dtoDeclarations = (roots = ROOTS): Map<string, string[]> => {
  const seen = new Map<string, string[]>();
  for (const root of roots) {
    for (const file of walk(join(ROOT, root))) {
      for (const m of readFileSync(file, 'utf8').matchAll(DTO)) {
        seen.set(m[1], [...(seen.get(m[1]) ?? []), relative(ROOT, file)]);
      }
    }
  }
  return seen;
};

describe('A15 - every DTO class has its own name', () => {
  it('no name is declared twice', () => {
    const twice = [...dtoDeclarations()].filter(([, files]) => files.length > 1);
    expect(twice).toEqual([]);
  });

  it('reads the DTOs of every module', () => {
    const names = [...dtoDeclarations().keys()];
    expect(names).toEqual(expect.arrayContaining(['GetLandUploadUrlDto', 'GetCourseUploadUrlDto']));
    expect(names.length).toBeGreaterThan(40);
  });
});
