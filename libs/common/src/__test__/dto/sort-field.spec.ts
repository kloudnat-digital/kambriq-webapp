import { BadRequestException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { sortField, TIMESTAMP_SORTS } from '../../dto/sort-field';
import { paginationQuerySchema } from '../../dto/pagination.dto';

const ROOT = join(__dirname, '..', '..', '..', '..', '..');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    if (['node_modules', 'dist', 'out-tsc', '__test__'].includes(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return extname(entry) === '.ts' && !entry.endsWith('.spec.ts') ? [full] : [];
  });

describe('the column a list is ordered by', () => {
  it('takes an allowed column', () => {
    expect(sortField('updatedAt', TIMESTAMP_SORTS, 'createdAt')).toBe('updatedAt');
  });

  it('falls back when nothing was asked for', () => {
    expect(sortField(undefined, TIMESTAMP_SORTS, 'createdAt')).toBe('createdAt');
    expect(sortField('', TIMESTAMP_SORTS, 'createdAt')).toBe('createdAt');
  });

  it('refuses a column that is not allowed, and names what is', () => {
    // The defect this closes: `?sort=nope` reached Prisma, which refused the
    // column, and the caller received a 500 for their own typo.
    expect(() => sortField('nope', TIMESTAMP_SORTS, 'createdAt')).toThrow(BadRequestException);
    expect(() => sortField('nope', TIMESTAMP_SORTS, 'createdAt')).toThrow(
      "Cannot sort by 'nope'. Allowed: createdAt, updatedAt.",
    );
  });

  it('refuses rather than quietly ordering by the default', () => {
    // A list ordered by something other than what was asked for is a wrong
    // answer the caller cannot detect.
    let returned: unknown = 'not thrown';
    try {
      returned = sortField('amount', TIMESTAMP_SORTS, 'createdAt');
    } catch {
      returned = 'thrown';
    }
    expect(returned).toBe('thrown');
  });

  it('is still fed an unconstrained string by the query schema, which is why it exists', () => {
    // Constraining `sort` in the schema would need one union of every sortable
    // column on every model, which authorises exactly the requests that still
    // fail. The check belongs at the call site, with that model's columns.
    expect(paginationQuerySchema.parse({ sort: 'anything-at-all' }).sort).toBe('anything-at-all');
  });

  it('is the only way a sort reaches an orderBy in the API', () => {
    // A thirteenth call site written the old way is the one this cannot catch by
    // running, so it is caught by reading.
    const offenders = walk(join(ROOT, 'apps/api/src'))
      .filter((f) => /orderBy: \{ \[(?!sortField)/.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(`${ROOT}/`, ''));

    expect(offenders).toEqual([]);
  });

  it('found the call sites, so the sweep above is not vacuous', () => {
    const wired = walk(join(ROOT, 'apps/api/src')).filter((f) =>
      readFileSync(f, 'utf8').includes('orderBy: { [sortField('),
    );
    expect(wired.length).toBe(9);
  });
});
