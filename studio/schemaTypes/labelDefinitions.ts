import { defineField, defineType } from 'sanity';

/**
 * The three KAMBRIQ labels, placed by an editor and written by nobody here.
 *
 * The text comes from `libs/common/src/kbs/label-definitions.ts` and is rendered
 * by the site. It is not editable in the Studio on purpose: the KBS question
 * bank is pinned to those same values, and a definition an editor could reword
 * would be the same fact recorded twice with nothing comparing the two. The
 * definitions were already corrected twice and regenerated wrong a third time -
 * see that file.
 *
 * So this block chooses a POSITION, not a wording.
 */
export const labelDefinitions = defineType({
  name: 'labelDefinitions',
  title: 'Les trois labels KAMBRIQ',
  type: 'object',
  fields: [
    defineField({
      name: 'note',
      title: 'Contenu',
      type: 'string',
      readOnly: true,
      initialValue: 'TFL, VEFL, VEFIL - texte fourni par le code, non modifiable ici.',
      description:
        'Les definitions sont pinnees a la banque de questions KBS. Pour les changer, il faut modifier libs/common/src/kbs/label-definitions.ts et lire la banque contre le nouveau texte.',
    }),
  ],
  preview: {
    prepare: () => ({
      title: 'Les trois labels KAMBRIQ',
      subtitle: 'TFL, VEFL, VEFIL - texte fourni par le code',
    }),
  },
});
