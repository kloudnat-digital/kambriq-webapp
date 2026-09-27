/**
 * The three KAMBRIQ labels, as fields.
 *
 * WHY THIS IS CODE AND NOT CONTENT. These definitions were corrected twice in
 * commits `1691b67` and `21ceed7`, then regenerated wrong a third time - "a VEFL
 * parcel has no title", which is the inverse of the product, in the material
 * that trains the agents who sell it. `methode/fr.mdx` was made the single
 * authoritative statement and `kbs-label-definitions.spec.ts` pinned the
 * question bank to it.
 *
 * Wave 7 moves editorial prose into Sanity, and a Sanity document cannot be read
 * by a test: CI has no token, and giving it one to guard three sentences is a
 * poor trade. Leaving the labels as prose in the CMS would therefore have
 * deleted the guard and left two statements of the same fact - the bank and the
 * page - with nothing comparing them. That is the defect this repository calls
 * a second record.
 *
 * So the labels are not prose anywhere. They are fields here, the `methode`
 * page renders them through a `labelDefinitions` block that carries no text of
 * its own, and the question bank is checked against the same constants. One
 * source, read by both.
 *
 * WHAT THIS DOES NOT DO: nothing here reads Cameroonian land law. A green run is
 * not a legal review.
 */

export const KBS_LABELS = ['TFL', 'VEFL', 'VEFIL'] as const;

export type KbsLabelCode = (typeof KBS_LABELS)[number];

export type KbsLabelLanguage = 'fr' | 'en';

/**
 * A run of the description.
 *
 * The description is runs rather than one string because the emphasis is
 * load-bearing: the mdx set "PAS" and "ET" in bold, and they are the two words a
 * buyer must not skim. Flattening them to plain text would have been a content
 * change made by a migration, which is the kind nobody reviews.
 */
export interface KbsLabelRun {
  readonly text: string;
  readonly strong?: true;
}

/**
 * One label.
 *
 * The four booleans are the substance. They are what a question in the bank can
 * contradict, and being values rather than sentences they are compared rather
 * than searched for - a check on a substring passes as long as the words are
 * somewhere on the page.
 *
 * `expansion` is the French legal term and is not translated: it names a
 * Cameroonian instrument, and the English page prints it in French too.
 */
export interface KbsLabelDefinition {
  readonly code: KbsLabelCode;
  readonly expansion: string;
  /** A title deed exists over the land. */
  readonly titleExists: boolean;
  /** Immatriculation is complete. */
  readonly registrationComplete: boolean;
  /** Lotissement is complete. */
  readonly subdivisionComplete: boolean;
  /** The buyer owns the land the day they sign. */
  readonly ownerAtSignature: boolean;
  /** The wording the site prints, per language. */
  readonly description: Record<KbsLabelLanguage, readonly KbsLabelRun[]>;
}

export const KBS_LABEL_DEFINITIONS: Record<KbsLabelCode, KbsLabelDefinition> = {
  TFL: {
    code: 'TFL',
    expansion: 'Titre Foncier Loti',
    titleExists: true,
    registrationComplete: true,
    subdivisionComplete: true,
    ownerAtSignature: true,
    description: {
      fr: [
        {
          text: "Le terrain possède un titre foncier individuel établi. C'est le niveau de sécurité le plus élevé. La transaction peut se faire immédiatement.",
        },
      ],
      en: [
        {
          text: 'The land has an individual title deed established. This is the highest security level. The transaction can proceed immediately.',
        },
      ],
    },
  },
  VEFL: {
    code: 'VEFL',
    expansion: 'Vente en État Futur de Lotissement',
    titleExists: true,
    registrationComplete: true,
    subdivisionComplete: false,
    ownerAtSignature: false,
    description: {
      fr: [
        {
          text: "Le titre foncier existe déjà - l'immatriculation est faite. Le lotissement est en cours. Vous achetez avec la certitude qu'un titre foncier individuel sera établi à l'issue du lotissement. Vous devenez propriétaire une fois le lotissement terminé. Les délais sont plus courts qu'un VEFIL™.",
        },
      ],
      en: [
        {
          text: 'The title deed already exists - land registration is complete. Subdivision is in progress. You purchase with the certainty that an individual title deed will be issued once subdivision is complete. Ownership transfers once subdivision is complete. Timelines are shorter than VEFIL™.',
        },
      ],
    },
  },
  VEFIL: {
    code: 'VEFIL',
    expansion: "Vente en État Futur d'Immatriculation et de Lotissement",
    titleExists: false,
    registrationComplete: false,
    subdivisionComplete: false,
    ownerAtSignature: false,
    description: {
      fr: [
        {
          text: "L'immatriculation est en cours. Le lotissement viendra après l'immatriculation. Vous n'êtes ",
        },
        { text: 'PAS', strong: true },
        { text: " propriétaire à la signature - vous devez attendre la fin de l'immatriculation " },
        { text: 'ET', strong: true },
        {
          text: " du lotissement. C'est le plus long des trois processus. KAMBRIQ vous accompagne tout au long avec des jalons de vérification supplémentaires.",
        },
      ],
      en: [
        {
          text: 'Land registration is in progress. Subdivision will follow registration. You are ',
        },
        { text: 'NOT', strong: true },
        { text: ' the owner upon signing - you must wait for both land registration ' },
        { text: 'AND', strong: true },
        {
          text: ' subdivision to complete. This is the longest of the three processes. KAMBRIQ accompanies you throughout with additional verification milestones.',
        },
      ],
    },
  },
};

/** The definition for a code, or `undefined` for a code that is not a label. */
export const kbsLabelDefinition = (code: string): KbsLabelDefinition | undefined =>
  (KBS_LABEL_DEFINITIONS as Record<string, KbsLabelDefinition>)[code];

/** The description as plain text, for anything that cannot render emphasis. */
export const kbsLabelDescriptionText = (
  definition: KbsLabelDefinition,
  language: KbsLabelLanguage,
): string => definition.description[language].map((run) => run.text).join('');
