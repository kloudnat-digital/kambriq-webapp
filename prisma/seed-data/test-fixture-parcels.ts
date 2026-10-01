/**
 * C16 - the parcels the automated suite reserves. TEST FIXTURES, NOT THE CATALOGUE.
 *
 * The real parcels are `lands-catalogue-v075.ts`, loaded unpublished by
 * `load-lands-catalogue.ts`. These two do not exist: they are published only
 * because a parcel must be published to be reserved, and the delivery journeys
 * and the browser suite reserve one. Anybody signed in on dev sees them, so
 * they are harmless by construction, not by convention:
 *
 * - `titleNumber` is null and `isVerified` false, always: a fixture never claims
 *   a title or a verification (`test-fixture-parcels.spec.ts` holds both);
 * - title and description say "démonstration" and "demonstration", in both
 *   languages, so nobody reads one as a KAMBRIQ offer.
 *
 * **Why two, and not one more.** `LandReservation` allows one live reservation
 * per parcel, so the count is the most reservations the suite holds at once:
 *
 * - the delivery journeys run in band (`runInBand`); journeys 4 and 5 each
 *   reserve one parcel and cancel it before the next test reserves: 1 at a time;
 * - the browser suite runs `fullyParallel` with 2 workers in CI, and two of its
 *   tests reserve - the I45 invitation link and the I46 deposit walk, both
 *   Chromium-only, both cancelling in `finally`: up to 2 at once;
 * - the journeys and the browser suite never overlap (`needs: [journeys]`), and
 *   develop's runs queue behind each other (`cancel-in-progress` is false on
 *   push); the balance journey that sells a parcel is opt-in and not run in CI.
 *
 * So 2. A run killed before its `finally` leaves one RESERVED until the seed
 * runs again; that is a reason to run the seed, not to carry spares.
 *
 * Both carry fiche 010A's figures (492 m2, 10 000 FCFA/m2, 4 920 000), so a
 * purchase page opened on either shows real arithmetic on a parcel that is not
 * real.
 */
import type { CatalogueLabel } from './lands-catalogue-v075';

export interface TestFixtureParcel {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly region: string;
  readonly city: string;
  readonly neighborhood: string;
  readonly sizeM2: number;
  readonly totalPrice: number;
  readonly label: CatalogueLabel;
  readonly titleNumber: null;
  readonly isVerified: false;
}

const DESCRIPTION =
  'Parcelle de démonstration pour les tests automatisés : elle n’existe pas et n’est pas à vendre. ' +
  'Demonstration parcel for automated tests: it does not exist and is not for sale.';

const fixture = (n: number, id: string): TestFixtureParcel => ({
  id,
  title: `Parcelle de démonstration ${n} / Demonstration parcel ${n}`,
  slug: `parcelle-de-demonstration-${n}`,
  description: DESCRIPTION,
  region: 'Démonstration',
  city: 'Démonstration',
  neighborhood: 'Démonstration',
  sizeM2: 492,
  totalPrice: 4_920_000,
  label: 'TFL',
  titleNumber: null,
  isVerified: false,
});

export const TEST_FIXTURE_PARCELS: readonly TestFixtureParcel[] = [
  fixture(1, '00000000-0000-4000-8000-e00000000041'),
  fixture(2, '00000000-0000-4000-8000-e00000000042'),
];
