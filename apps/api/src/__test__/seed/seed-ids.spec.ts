import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

/**
 * Every identifier the seed writes must satisfy the API's own validation.
 *
 * The seed used `00000000-0000-0000-0000-<prefix><counter>` throughout - 47
 * hardcoded ids plus 480 generated ones. PostgreSQL stores those happily: as far
 * as the database is concerned they are valid `uuid` values. `z.uuid()` does
 * not accept them. RFC 4122 puts the version in the first nibble of group 3
 * (must be 1-8) and the variant in the first nibble of group 4 (must be 8, 9, a
 * or b); the seed wrote `0` for both.
 *
 * So the API rejected its own seed data. Twenty-three request-body fields
 * across KBS, KAMNET and LANDS are declared `z.uuid()`, and a tester sending a
 * seeded id to any of them got `Invalid UUID` - a 400 that reads like a client
 * mistake and is not one. Submitting a quiz answer, saving an exam answer,
 * attaching a lead to a seeded parcel: all unreachable with the data seeded for
 * exactly that purpose.
 *
 * Nothing caught it because the two systems disagreed silently. The write side
 * (Prisma to Postgres) accepted the value, the read side returned it, and only
 * a request carrying one in a *body* ever met the stricter rule. This test puts
 * both sides in the same place: it runs the ids the seed actually emits through
 * the same validator the controllers use.
 */
const SEED = readFileSync(join(__dirname, '../../../../../prisma/seed.ts'), 'utf8');

const UUID_LITERAL = /'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'/g;

describe('seed identifiers are valid UUIDs by the API’s own rule', () => {
  const literals = [...SEED.matchAll(UUID_LITERAL)].map((m) => m[1]);

  it('finds the hardcoded ids (guards the regex itself, not just the ids)', () => {
    // A measurement that returns nothing must not read as a pass. Every wrong
    // number this week came from the measurement, not the thing measured.
    expect(literals.length).toBeGreaterThan(40);
  });

  it.each([...new Set(literals)])('%s passes z.uuid()', (id) => {
    expect(z.uuid().safeParse(id).success).toBe(true);
  });

  /**
   * The generated ids matter more than the literals: there are 480 of them and
   * they are built by string concatenation, which is where a wrong nibble hides
   * best.
   */
  describe('generated question and answer ids', () => {
    const qId = (mod: number, n: number, exam: boolean) =>
      `00000000-0000-4000-8000-f${exam ? '3' : '1'}${mod}${String(n).padStart(9, '0')}`;
    const aId = (mod: number, n: number, a: number, exam: boolean) =>
      `00000000-0000-4000-8000-f${exam ? '4' : '2'}${mod}${String(n).padStart(5, '0')}${String(
        a,
      ).padStart(4, '0')}`;

    it('every id the two generators can emit is a valid UUID', () => {
      const emitted: string[] = [];
      for (const exam of [false, true]) {
        for (const mod of [1, 2]) {
          for (let n = 1; n <= 30; n++) {
            emitted.push(qId(mod, n, exam));
            for (let a = 1; a <= 4; a++) emitted.push(aId(mod, n, a, exam));
          }
        }
      }
      expect(emitted).toHaveLength(600);
      expect(new Set(emitted).size).toBe(600); // no collisions
      const rejected = emitted.filter((id) => !z.uuid().safeParse(id).success);
      expect(rejected).toEqual([]);
    });

    it('the generators are the ones the seed actually uses', () => {
      // Pins the shape in the seed file, so editing the generator there without
      // editing it here fails rather than drifting.
      expect(SEED).toContain("`00000000-0000-4000-8000-f${exam ? '3' : '1'}${mod}$");
      expect(SEED).toContain("`00000000-0000-4000-8000-f${exam ? '4' : '2'}${mod}$");
    });
  });
});
