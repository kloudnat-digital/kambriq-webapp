import type { CatalogueLabel, CatalogueParcel } from './lands-catalogue-v075';

/**
 * C16 - the rows `prisma/load-lands-catalogue.ts` creates, kept free of IO so
 * the rules can be tested without a database.
 *
 * Every row is created unpublished: nothing from the catalogue is visible
 * before D13, and publishing the twelve validated parcels is a separate act.
 * `pricePerM2` is not written - the database generates it from `totalPrice`
 * and `sizeM2` (G19) - and `titleNumber` is left null (see the catalogue
 * module's header).
 */
export interface CatalogueLandRow {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly region: string;
  readonly city: string | null;
  readonly neighborhood: string | null;
  readonly sizeM2: number;
  readonly totalPrice: bigint;
  readonly labelId: string;
  readonly isPublished: false;
  readonly ownerType: 'KAMBRIQ';
  readonly verificationRef: string;
  readonly titleNumber: string | null;
}

export const catalogueLandRows = (
  parcels: readonly CatalogueParcel[],
  labelIds: Readonly<Record<CatalogueLabel, string>>,
): CatalogueLandRow[] =>
  parcels.map((parcel) => {
    // The check the database makes: the price per m2 it generates from the
    // total (G19) must be the one the fiche states.
    if (Math.round(parcel.totalPrice / parcel.sizeM2) !== parcel.pricePerM2) {
      throw new Error(
        `${parcel.ref}: ${parcel.totalPrice} over ${parcel.sizeM2} m2 is not ${parcel.pricePerM2} per m2`,
      );
    }
    const labelId = labelIds[parcel.label];
    if (!labelId) throw new Error(`${parcel.ref}: no label ${parcel.label} in the database`);
    return {
      id: parcel.id,
      title: parcel.title,
      slug: parcel.slug,
      description: parcel.description,
      region: parcel.region,
      city: parcel.city,
      neighborhood: parcel.neighborhood,
      sizeM2: parcel.sizeM2,
      totalPrice: BigInt(parcel.totalPrice),
      labelId,
      isPublished: false,
      ownerType: 'KAMBRIQ',
      verificationRef: parcel.ref,
      titleNumber: parcel.titleNumber,
    };
  });

/** What a row already in the database differs on, field by field. Empty when it matches. */
export const catalogueDrift = (
  row: CatalogueLandRow,
  found: Readonly<Record<keyof CatalogueLandRow, unknown>>,
): string[] =>
  (Object.keys(row) as (keyof CatalogueLandRow)[]).filter((key) => {
    const want = row[key];
    const have = found[key];
    return typeof want === 'bigint' ? BigInt(String(have)) !== want : have !== want;
  });
