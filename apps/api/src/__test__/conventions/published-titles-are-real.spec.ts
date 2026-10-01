/* eslint-disable @nx/enforce-module-boundaries -- the seed lives in prisma/, outside any nx project; these tests exist to pin it */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGUE_PARCELS } from '../../../../../prisma/seed-data/lands-catalogue-v075';
import { REAL_TITLES } from '../../../../../prisma/seed-data/real-titles';

/**
 * C16 - a published parcel's title number is a real title, or it is null.
 *
 * Until 1 October the seed published twenty invented parcels, eight of them
 * with invented titles in the real Cameroonian shape (`TF 1187/WB`...). P24
 * checks that shape, and a shape cannot tell an invented number from a real
 * one. So the rule is a list: `prisma/seed-data/real-titles.ts`, reviewed, each
 * entry with the document it was read from. A title not on it is refused.
 *
 * What is checked: every parcel the seed publishes, and every catalogue parcel
 * (which load unpublished, but are the ones that will be published).
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SEED = readFileSync(join(ROOT, 'prisma', 'seed.ts'), 'utf8');

/** The seed's parcel literals: each starts at `id: IDS.LAND_<n>,`. */
const seedParcels = SEED.split(/(?=\n\s+id: IDS\.LAND_\d+,)/)
  .slice(1)
  .map((block) => ({
    id: /id: IDS\.(LAND_\d+),/.exec(block)?.[1] ?? '',
    isPublished: /isPublished: true,/.test(block.split('\n    },')[0]),
    titleNumber: /titleNumber: '([^']+)',/.exec(block.split('\n    },')[0])?.[1] ?? null,
  }));

const listed = new Set(REAL_TITLES.map((t) => t.titleNumber));

describe('C16 - published titles are real', () => {
  it('is reading the parcels it thinks it is', () => {
    // A split that finds nothing would make every assertion below vacuous.
    expect(seedParcels.length).toBeGreaterThanOrEqual(20);
    expect(CATALOGUE_PARCELS).toHaveLength(14);
  });

  it('every registry entry names its source', () => {
    for (const title of REAL_TITLES) {
      expect(title.titleNumber).toMatch(/^TF \S+\/\S+$/);
      expect(title.source.trim().length).toBeGreaterThan(0);
    }
  });

  it('no parcel the seed publishes carries an unlisted title', () => {
    const unlisted = seedParcels
      .filter((p) => p.isPublished && p.titleNumber !== null && !listed.has(p.titleNumber))
      .map((p) => `${p.id} ${p.titleNumber}`);
    expect(unlisted).toEqual([]);
  });

  it('no catalogue parcel carries an unlisted title', () => {
    const unlisted = CATALOGUE_PARCELS.map((p) => ({ ref: p.ref, t: p.titleNumber }))
      .filter((p) => p.t !== null && !listed.has(p.t))
      .map((p) => `${p.ref} ${p.t}`);
    expect(unlisted).toEqual([]);
  });
});
