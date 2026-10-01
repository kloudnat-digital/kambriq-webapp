/**
 * C16 - the reviewed registry of real land titles.
 *
 * A parcel may carry a `titleNumber` only if the number is listed here, with
 * the document it was read from. The API refuses any other on create and on
 * update (`LandsService`), and `published-titles-are-real.spec.ts` refuses one
 * in the seed or the catalogue data. A null title is better than a wrong one.
 *
 * **Adding a title is an edit to this file, reviewed in a pull request** - the
 * ceremony a land title number deserves. Nothing typed in the back office can
 * add one, so nothing typed there can invent one.
 *
 * Empty on purpose. The LANDS catalogue v07.5 names titles, but none belongs to
 * a lot that is loaded as a parcel: TF 9085/SM is the title 010A and 010B are
 * carved from; TF 7656/SM (006) and TF 8046/SM (012) are lotissement titles;
 * TF 12206/Lékié (018) is a mother title; TF 38677/38676/38674 (008),
 * TF 9078/SM (011) and TF 4261/SM (017) are sites, not parcels. An entry is
 * added when a lot's own title is read on its own document.
 */
export interface RealTitle {
  /** The canonical form the API stores (`parseTitleNumber`), e.g. `TF 4129/M`. */
  readonly titleNumber: string;
  /** The document it was read from: file name, page or fiche, and who reviewed it. */
  readonly source: string;
}

/** Where to add a title. Named in the API's refusal; the refusal never echoes a value. */
export const REAL_TITLES_FILE = 'libs/common/src/lands/real-titles.ts';

export const REAL_TITLES: readonly RealTitle[] = [];

/** Whether a stored-form title is listed. Pass the registry explicitly so a test can list one. */
export const isListedTitle = (titleNumber: string, registry: readonly RealTitle[]): boolean =>
  registry.some((t) => t.titleNumber === titleNumber);
