/**
 * P24 - the Cameroonian land title number: `TF <digits>/<letters>`.
 *
 * The letters name the department where the title is registered - one, two or
 * three of them: `M` for Menoua, `SM` for Sanaga-Maritime, `WB` for Wouri B
 * (Visquis, 25 September 2026). `TF 4129/M` is well formed.
 *
 * **The shape is the rule, never a list of departments.** We do not hold the
 * complete list, and a list missing one department refuses a real person's
 * real title - a door closed on a customer, which is worse than the invented
 * formats this replaced. `KNOWN_DEPARTMENT_CODES` is kept apart for that
 * reason: when a list arrives it may drive a WARNING, and nothing here reads it
 * to accept or refuse.
 *
 * **The digits are a range, 1 to 6.** A title's number is its rank in its
 * registry, so a young registry issues short numbers and an old urban one long
 * ones. `4129` was an example, not a width; six digits leaves room for any
 * registry's history while still refusing a pasted phone number.
 *
 * **Input is forgiven, storage is not.** A person typing on a telephone writes
 * `tf4129 / m` or `TF-4129/M`; all of them are the same title, and all of them
 * are stored as `TF 4129/M` - one canonical form, so the unique index and a
 * search see one title rather than four spellings of it.
 */
export const TITLE_NUMBER_EXAMPLE = 'TF 4129/M';

const TITLE_NUMBER_SHAPE = /^TF[\s.-]*(?:N[°O]?\.?\s*)?(\d{1,6})\s*[/-]\s*([A-Z]{1,3})$/;

export type TitleNumber = {
  /** `TF 4129/M` - the form that is stored. */
  canonical: string;
  number: string;
  department: string;
};

/** The title a person typed, or `null` when it does not have the shape. */
export const parseTitleNumber = (input: string): TitleNumber | null => {
  const match = TITLE_NUMBER_SHAPE.exec(input.trim().toUpperCase());
  if (!match) return null;
  const [, number, department] = match;
  return { canonical: `TF ${number}/${department}`, number, department };
};

/**
 * Department codes confirmed by Visquis. Empty until his list arrives, and read
 * only by `isUnlistedDepartment` - never by the decision to accept or refuse.
 */
export const KNOWN_DEPARTMENT_CODES: ReadonlySet<string> = new Set<string>();

/**
 * Whether a title names a department nobody has listed - grounds for a
 * warning, never for a refusal. Always `false` while no list exists: a warning
 * on every title would be noise, and noise is read as nothing.
 */
export const isUnlistedDepartment = (
  title: TitleNumber,
  known: ReadonlySet<string> = KNOWN_DEPARTMENT_CODES,
): boolean => known.size > 0 && !known.has(title.department);
