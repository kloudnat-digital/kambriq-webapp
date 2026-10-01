/* eslint-disable @nx/enforce-module-boundaries -- the seed lives in prisma/, outside any nx project; these tests exist to pin it */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGUE_PARCELS } from '../../../../../prisma/seed-data/lands-catalogue-v075';
import { TEST_FIXTURE_PARCELS } from '../../../../../prisma/seed-data/test-fixture-parcels';

/**
 * C16 - the parcels the suite reserves are harmless by construction.
 *
 * They are invented and published, so they never claim a title or a
 * verification, and they say what they are in both languages. Their number is
 * the suite's concurrent need (see the module's header), not a comfort margin.
 */
const SEED = readFileSync(join(__dirname, '../../../../../prisma/seed.ts'), 'utf8');

describe('C16 - test fixture parcels', () => {
  it('are two: the most live reservations the suite holds at once', () => {
    expect(TEST_FIXTURE_PARCELS).toHaveLength(2);
  });

  it('never carry a title or a verification claim', () => {
    for (const f of TEST_FIXTURE_PARCELS) {
      expect(f.titleNumber).toBeNull();
      expect(f.isVerified).toBe(false);
    }
  });

  it('say demonstration in French and in English, in the title and the description', () => {
    for (const f of TEST_FIXTURE_PARCELS) {
      expect(f.title).toMatch(/démonstration/);
      expect(f.title).toMatch(/Demonstration/);
      expect(f.description).toMatch(/démonstration/);
      expect(f.description).toMatch(/Demonstration/);
    }
  });

  it('carry 010A’s figures, and share no id or slug with the catalogue', () => {
    const a = CATALOGUE_PARCELS.find((p) => p.num === '010A');
    const catalogue = new Set(CATALOGUE_PARCELS.flatMap((p) => [p.id, p.slug]));
    for (const f of TEST_FIXTURE_PARCELS) {
      expect({ sizeM2: f.sizeM2, totalPrice: f.totalPrice }).toEqual({
        sizeM2: a?.sizeM2,
        totalPrice: a?.totalPrice,
      });
      expect(catalogue.has(f.id) || catalogue.has(f.slug)).toBe(false);
    }
  });

  it('are the only parcels the seed publishes; the twenty invented ones are archived', () => {
    const lands = SEED.slice(
      SEED.indexOf('const inventedParcels'),
      SEED.indexOf('const fixtureLabel'),
    );
    expect(lands.match(/id: IDS\.LAND_\d+,/g)).toHaveLength(20);
    expect(lands.match(/status: LandStatus\.ARCHIVED,/g)).toHaveLength(20);
    expect(lands.match(/isPublished: false,/g)).toHaveLength(20);
    expect(lands).not.toMatch(/isPublished: true|isVerified: true|verifiedAt:/);
  });
});
