import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLandSchema, updateLandSchema } from '../../../lands/dto/lands.dto';

/**
 * P24 - a land title number is shaped like a Cameroonian titre foncier.
 *
 * `TF <digits>/<one to three letters>`, the letters naming the department:
 * `TF 4129/M` for Menoua (Visquis, 25 September). Until now nothing was refused -
 * `z.string().max(100)` on both DTOs - and the site showed three invented formats.
 *
 * The API is the rule; the web form repeats it as a courtesy. What is checked is
 * the SHAPE and never a list of departments: a list missing one would refuse a
 * real person's real title.
 */
const base = {
  title: 'Parcelle',
  description: 'Une parcelle',
  region: 'Littoral',
  sizeM2: 500,
  totalPrice: 1_000_000,
  labelId: 'label',
};
const create = (titleNumber?: string) => createLandSchema.safeParse({ ...base, titleNumber });
const update = (titleNumber?: string) => updateLandSchema.safeParse({ titleNumber });

describe.each([
  ['create', create],
  ['update', update],
] as const)('P24 - the %s DTO', (_name, parse) => {
  it('accepts a well-formed title and stores its canonical form', () => {
    const r = parse('TF 4129/M');
    expect(r.success && r.data.titleNumber).toBe('TF 4129/M');
  });

  it('refuses the format the verify page used to show, and names the expected shape', () => {
    const r = parse('TF-12345-ABCD');
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('TF 4129/M');
  });

  it('refuses the format the seed used to invent', () => {
    expect(parse('TF-CM-LT-2025-001').success).toBe(false);
  });

  it('accepts a department code nobody has listed - the shape is the rule, not a list', () => {
    const r = parse('TF 77/XQZ');
    expect(r.success && r.data.titleNumber).toBe('TF 77/XQZ');
  });

  it('still accepts no title at all', () => {
    expect(parse(undefined).success).toBe(true);
    const empty = parse('');
    expect(empty.success && empty.data.titleNumber).toBe('');
  });

  it('stores one canonical form after a messy, phone-typed input', () => {
    const r = parse('  tf4129 / sm ');
    expect(r.success && r.data.titleNumber).toBe('TF 4129/SM');
  });
});

/** The demonstration data is what a demonstration shows. */
describe('P24 - the seeded titles', () => {
  const seed = readFileSync(join(__dirname, '../../../../../../prisma/seed.ts'), 'utf8');
  const seeded = [...seed.matchAll(/titleNumber: '([^']+)'/g)].map((m) => m[1]);

  it('are well formed', () => {
    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.filter((t) => !create(t).success)).toEqual([]);
  });

  it('are stored in their canonical form', () => {
    expect(seeded.filter((t) => create(t).data?.titleNumber !== t)).toEqual([]);
  });

  it('are restored by a re-run, not only written on the first one', () => {
    const update = seed.match(/lands\.land\.upsert\(\{[\s\S]*?update: \{([\s\S]*?)\},\n\s*\}\);/);
    expect(update?.[1]).toContain('titleNumber: parcel.titleNumber');
  });
});
