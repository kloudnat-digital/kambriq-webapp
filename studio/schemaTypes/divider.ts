import { defineField, defineType } from 'sanity';

/**
 * A horizontal rule between sections.
 *
 * Portable Text has no separator of its own, so it is an object type.
 *
 * It carries one field because Sanity refuses an object type with none - "Object
 * should have at least one field", reported by `sanity schema validate` and by
 * the Studio at runtime, not by `sanity build`. Nothing reads `note`: the web
 * renders this block as `<hr>` whatever it contains, and the documents the
 * migration produced carry no such field at all. It is hidden so an editor sees
 * a separator rather than a box asking them for a value.
 */
export const divider = defineType({
  name: 'divider',
  title: 'Separateur',
  type: 'object',
  fields: [
    defineField({
      name: 'note',
      type: 'string',
      hidden: true,
      initialValue: 'separator',
    }),
  ],
  preview: { prepare: () => ({ title: '---' }) },
});
