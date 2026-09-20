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

/**
 * The seed must configure the active course, and must not choose it twice.
 *
 * `checkAndTransitionToExamPending` reads `kbsSettings.activeCourseId` first and
 * returns when it is null, and `me/overview` answers `course: null,
 * modulesTotal: 0` for the same reason. The seed created the settings row with
 * `update: {}` and never set the field, so on dev a candidate passed every
 * module, stayed IN_TRAINING, and was told to "finish all the modules" they had
 * just finished. That much is unchanged and still has to hold.
 *
 * ---------------------------------------------------------------------------
 * Why this test was INVERTED rather than updated (I42)
 * ---------------------------------------------------------------------------
 * It used to read `sets activeCourseId on create and on update`, and asserted
 * the id appeared in the upsert exactly TWICE. That assertion was accurate
 * about the code and wrong about the requirement: it was green for exactly as
 * long as the defect existed and went red the day somebody fixed it.
 *
 * The defect is that the active course is a CHOICE. An administrator sets it
 * through `PATCH /kbs/settings` - the KCA1 switch was that - and a seed writing
 * the id on every run reverted the switch silently, on a green run, leaving
 * every candidate on the wrong course. Repairing a NULL and overruling a choice
 * were one line, so the fix separates them and this test had to stop requiring
 * the half that was wrong.
 *
 * What a text guard can honestly pin is the WIRING: that the seed still
 * configures the course, and that the unconditional write is gone. The rule
 * itself - repair only where NULL, leave any named course alone - is behaviour,
 * and it is proved against real Postgres in `kbs-settings-seed.dbspec.ts`, on
 * both halves, because a fix that never writes and a fix that always writes are
 * each half right.
 */
describe('seed configures the active course', () => {
  it('configures it through the shared helper, with the seeded course', () => {
    const call = SEED.slice(SEED.indexOf('seedKbsSettings('));
    const args = call.slice(0, call.indexOf('});') + 3);

    expect(args).toContain('activeCourseId: IDS.KBS_COURSE');
  });

  /**
   * The unconditional write is what reverted the switch. If it comes back
   * inline, this fails naming the file rather than waiting for somebody to
   * notice candidates on the wrong course.
   */
  it('no longer writes the active course unconditionally', () => {
    expect(SEED).not.toContain('kbsSettings.upsert');
  });
});

/**
 * A seeded fixture must be returned to its seeded state by a re-run.
 *
 * `land.upsert` used `update: {}`, so re-seeding changed nothing about an
 * existing parcel. A tester reserving parcels moves them AVAILABLE -> RESERVED
 * -> SOLD and no amount of re-seeding gave them back: five parcels, five
 * reservations, and the sixth run looks like a broken platform rather than an
 * exhausted fixture. The seed printed "5 parcels seeded" every time, over a pool
 * it had not restored.
 *
 * Idempotent means "running twice is not worse than running once". Restorative
 * means "running again puts it back". The seed claimed the first and was read as
 * the second.
 */
describe('the seed restores the fixtures it owns', () => {
  const landsBlock = SEED.slice(SEED.indexOf('async function seedLands'));

  it('resets the parcel status a journey mutates, rather than update: {}', () => {
    const upsert = landsBlock.slice(
      landsBlock.indexOf('lands.land.upsert'),
      landsBlock.indexOf('lands.landReservation.upsert'),
    );
    // The requirement is that the update clause writes a status derived from the
    // seeded one, not that it copies it verbatim. A31 routes it through
    // restoredParcelStatus, which returns the seeded status unless a reservation
    // the seed could not delete still holds the parcel. Asserting the literal
    // `status: parcel.status` pinned the defect, not the rule.
    expect(upsert).toMatch(/status:\s*restoredParcelStatus\(parcel\.status,/);
    expect(upsert).not.toMatch(/update:\s*\{\s*\}/);
  });

  it('clears the reservations a journey created against seeded parcels', () => {
    expect(landsBlock).toContain('lands.landReservation.deleteMany');
    // Only the seed's own parcels, and never the seeded reservation itself.
    expect(landsBlock).toContain('landId: { in: seededParcelIds }');
    expect(landsBlock).toContain('id: { not: IDS.LAND_RESERVATION_SEEDED }');
  });

  /**
   * A pool that survives one pass is the same zero-margin mistake as ten quiz
   * questions against a threshold of ten. A full journey pass consumes one
   * parcel; a suite run consumes a handful.
   */
  it('seeds a parcel pool with real margin, not exactly enough', () => {
    const ids = [...landsBlock.matchAll(/id: IDS\.LAND_(\d+),/g)].map((m) => Number(m[1]));
    const parcelCount = new Set(ids).size;
    expect(parcelCount).toBeGreaterThanOrEqual(20);

    const available = [...landsBlock.matchAll(/status: LandStatus\.AVAILABLE,/g)].length;
    expect(available).toBeGreaterThanOrEqual(15);
  });
});

/**
 * The seed must check what it claims, not announce it.
 *
 * The first restorative fix keyed `landReservation.upsert` on a non-unique
 * column, printed nothing for lands, and exited non-zero. The exhaustion proof
 * still looked right — parcels were restored before the failure, so the counts
 * moved — and it was read as passing. The success line never printed and its
 * absence was not noticed.
 */
describe('the seed verifies its own postcondition', () => {
  const landsBlock = SEED.slice(SEED.indexOf('async function seedLands'));

  it('counts the available parcels back before reporting them', () => {
    expect(landsBlock).toContain('Lands seed postcondition failed');
    expect(landsBlock).toContain(
      'const actualAvailable = await lands.land.count({ where: { status: LandStatus.AVAILABLE } })',
    );
  });

  it('reports the counted number, not the intended one', () => {
    const log = landsBlock.slice(landsBlock.indexOf('✓ Lands seeded'));
    expect(log).toContain('${actualAvailable} available');
  });

  it('keys the seeded reservation on its own id, which is unique', () => {
    // `landId` carries no unique constraint: a parcel may have several
    // reservations over its life, and Postgres refuses the ON CONFLICT.
    expect(landsBlock).toContain('where: { id: IDS.LAND_RESERVATION_SEEDED }');
    expect(landsBlock).not.toContain('where: { landId: IDS.LAND_3 }');
  });
});
