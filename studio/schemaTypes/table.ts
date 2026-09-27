import { defineArrayMember, defineField, defineType } from 'sanity';

/**
 * A simple table: one header row and any number of data rows.
 *
 * Portable Text has no table, and two pages carried a raw HTML one - the VERIFY
 * price list. Converting it to paragraphs would have been a presentation change
 * made by a migration, so the structure is modelled instead.
 *
 * Rows are objects because a Sanity array cannot contain another array.
 */
export const table = defineType({
  name: 'table',
  title: 'Tableau',
  type: 'object',
  fields: [
    defineField({
      name: 'columns',
      title: 'En-tetes',
      type: 'array',
      of: [{ type: 'string' }],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'rows',
      title: 'Lignes',
      type: 'array',
      of: [
        defineArrayMember({
          name: 'tableRow',
          type: 'object',
          fields: [
            defineField({
              name: 'cells',
              title: 'Cellules',
              type: 'array',
              of: [{ type: 'string' }],
              validation: (rule) => rule.required().min(1),
            }),
          ],
          preview: {
            select: { cells: 'cells' },
            prepare: ({ cells }: { cells?: string[] }) => ({ title: (cells ?? []).join(' | ') }),
          },
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: { columns: 'columns', rows: 'rows' },
    prepare: ({ columns, rows }: { columns?: string[]; rows?: unknown[] }) => ({
      title: (columns ?? []).join(' | '),
      subtitle: `${(rows ?? []).length} lignes`,
    }),
  },
});
