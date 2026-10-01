/**
 * C16 - the reviewed registry of real land titles.
 *
 * A published parcel may carry a `titleNumber` only if the number is listed
 * here, with the document it was read from. The guard
 * `apps/api/src/__test__/conventions/published-titles-are-real.spec.ts`
 * refuses any other. A null title is better than a wrong one.
 *
 * Empty on purpose. The LANDS catalogue v07.5 names titles, but none belongs to
 * a lot that is loaded as a parcel: TF 9085/SM is the title 010A and 010B are
 * carved from; TF 7656/SM (006) and TF 8046/SM (012) are lotissement titles;
 * TF 12206/Lékié (018) is a mother title; TF 38677/38676/38674 (008),
 * TF 9078/SM (011) and TF 4261/SM (017) are sites, not parcels. An entry is
 * added when a lot's own title is read on its own document.
 */
export interface RealTitle {
  /** `TF <digits>/<department>`, as the title document writes it. */
  readonly titleNumber: string;
  /** The document it was read from: file name, page or fiche, and who reviewed it. */
  readonly source: string;
}

export const REAL_TITLES: readonly RealTitle[] = [];
