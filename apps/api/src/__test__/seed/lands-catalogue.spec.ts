/* eslint-disable @nx/enforce-module-boundaries -- the seed lives in prisma/, outside any nx project; these tests exist to pin it */
import {
  CATALOGUE_DEFERRED,
  CATALOGUE_PARCELS,
  CATALOGUE_SITES,
} from '../../../../../prisma/seed-data/lands-catalogue-v075';
import {
  catalogueDrift,
  catalogueLandRows,
} from '../../../../../prisma/seed-data/lands-catalogue-load';

/**
 * C16 - the real catalogue, v07.5, as it is loaded: fourteen parcels, all
 * unpublished, figures equal to the fiches; five sites described, not loaded;
 * 018 deferred.
 */
const LABEL_IDS = { TFL: 'label-tfl', VEFL: 'label-vefl', VEFIL: 'label-vefil' } as const;
const rows = catalogueLandRows(CATALOGUE_PARCELS, LABEL_IDS);

describe('C16 - the LANDS catalogue v07.5', () => {
  it('has fourteen parcels, twelve of them validated', () => {
    expect(CATALOGUE_PARCELS.map((p) => p.num)).toEqual([
      '001',
      '002',
      '003',
      '004',
      '005',
      '006',
      '010A',
      '010B',
      '010C',
      '012',
      '014',
      '015',
      '019',
      '020',
    ]);
    expect(CATALOGUE_PARCELS.filter((p) => p.validated)).toHaveLength(12);
    expect(CATALOGUE_PARCELS.filter((p) => !p.validated).map((p) => p.num)).toEqual(['015', '020']);
  });

  it('prices every parcel as size x price per m2, 247 107 000 in all', () => {
    for (const p of CATALOGUE_PARCELS) expect(p.totalPrice).toBe(p.sizeM2 * p.pricePerM2);
    expect(CATALOGUE_PARCELS.reduce((n, p) => n + p.totalPrice, 0)).toBe(247_107_000);
  });

  it('carries 010A as the fiche states it: 492 m2 at 10 000, 4 920 000', () => {
    const lot = CATALOGUE_PARCELS.find((p) => p.num === '010A');
    expect(lot).toMatchObject({
      sizeM2: 492,
      pricePerM2: 10_000,
      totalPrice: 4_920_000,
      label: 'TFL',
    });
  });

  it('keeps ids and slugs unique, and does not repeat "indicatif" (firm prices)', () => {
    expect(new Set(CATALOGUE_PARCELS.map((p) => p.id)).size).toBe(14);
    expect(new Set(CATALOGUE_PARCELS.map((p) => p.slug)).size).toBe(14);
    for (const p of CATALOGUE_PARCELS) expect(p.description).not.toMatch(/indicatif/i);
  });

  it('describes the five sites without loading them, and defers 018', () => {
    expect(CATALOGUE_SITES.map((s) => s.num)).toEqual(['007', '008', '011', '016', '017']);
    const loaded = new Set(CATALOGUE_PARCELS.map((p) => p.num));
    for (const num of [...CATALOGUE_SITES.map((s) => s.num), ...CATALOGUE_DEFERRED]) {
      expect(loaded.has(num)).toBe(false);
    }
  });
});

describe('C16 - the rows the loader creates', () => {
  it('creates every row unpublished, owned by KAMBRIQ, referenced to its fiche', () => {
    expect(rows).toHaveLength(14);
    for (const [i, row] of rows.entries()) {
      expect(row.isPublished).toBe(false);
      expect(row.ownerType).toBe('KAMBRIQ');
      expect(row.verificationRef).toBe(CATALOGUE_PARCELS[i].ref);
      expect(row.totalPrice).toBe(BigInt(CATALOGUE_PARCELS[i].totalPrice));
    }
  });

  it('never writes pricePerM2, which the database generates (G19)', () => {
    for (const row of rows) expect(Object.keys(row)).not.toContain('pricePerM2');
  });

  it('maps each label code to the database id', () => {
    expect(rows.find((r) => r.verificationRef.endsWith('_010C'))?.labelId).toBe('label-vefl');
    expect(rows.find((r) => r.verificationRef.endsWith('_015'))?.labelId).toBe('label-vefil');
  });

  it('refuses a missing label rather than guessing one', () => {
    expect(() => catalogueLandRows(CATALOGUE_PARCELS, { TFL: 'x', VEFL: 'y' } as never)).toThrow(
      /no label VEFIL/,
    );
  });

  it('refuses a parcel whose total does not give its price per m2', () => {
    const bad = [{ ...CATALOGUE_PARCELS[0], totalPrice: 1 }];
    expect(() => catalogueLandRows(bad, LABEL_IDS)).toThrow(/is not 17000 per m2/);
  });

  it('reports drift field by field and nothing when the row matches', () => {
    const row = rows[0];
    expect(catalogueDrift(row, { ...row, totalPrice: '6800000' } as never)).toEqual([]);
    expect(catalogueDrift(row, { ...row, isPublished: true, sizeM2: 401 } as never)).toEqual([
      'sizeM2',
      'isPublished',
    ]);
  });
});
