/* eslint-disable @nx/enforce-module-boundaries -- the seed lives in prisma/, outside any nx project; these tests exist to pin it */
import { z } from 'zod';
import { RoleCode } from '@kambriq/common';
import { SEED_ROLES, seedRoleId } from '../../../../../prisma/seed-data/roles';

/**
 * I19 - the seed creates a row for every role the code knows.
 *
 * The seed wrote 8 rows for an enum of 11. `addRole` refuses a code that has no
 * row, so a role the API declares could be neither granted nor held, and the
 * first route guarded by one of the missing three would have been reachable by
 * nobody. Held against the enum itself, so adding a role to `RoleCode` without
 * seeding it fails here rather than in front of a user.
 */
describe('the seed creates every role in the enum', () => {
  it('has exactly one row per RoleCode', () => {
    expect(SEED_ROLES.map((r) => r.code).sort()).toEqual(Object.values(RoleCode).sort());
  });

  it('gives every row a distinct id the API itself accepts', () => {
    const ids = SEED_ROLES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !z.uuid().safeParse(id).success)).toEqual([]);
  });

  it('keeps the ids the seed already wrote, so a re-run upserts instead of duplicating', () => {
    // Rows are upserted on `code`, so an id change would not duplicate a row -
    // but role assignments reference these ids, and they must not move.
    expect(seedRoleId(RoleCode.ADMIN_GLOBAL)).toBe('00000000-0000-4000-8000-a00000000001');
    expect(seedRoleId(RoleCode.ADMIN_LANDS)).toBe('00000000-0000-4000-8000-a00000000008');
  });
});
