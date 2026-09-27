import { defineArrayMember } from 'sanity';

/**
 * The rich-text block both document types use.
 *
 * Mirrors `CONTENT_BLOCK_STYLES`, `CONTENT_BLOCK_DECORATORS` and
 * `CONTENT_BLOCK_LISTS` in `libs/common/src/cms/content-page.ts`, pinned by
 * `studio-schema-matches-the-contract.spec.ts`.
 *
 * The lists are explicit rather than left to Sanity's defaults, which offer h1
 * to h6, underline and strike-through. The site styles none of those, and
 * `@portabletext/react` merges its own components under ours - so an h5 renders
 * as an unstyled heading and never reaches the missing-component handler. The
 * editor is therefore not offered it.
 */
export const richTextBlock = defineArrayMember({
  type: 'block',
  styles: [
    { title: 'Paragraphe', value: 'normal' },
    { title: 'Titre 2', value: 'h2' },
    { title: 'Titre 3', value: 'h3' },
    { title: 'Titre 4', value: 'h4' },
    { title: 'Citation', value: 'blockquote' },
  ],
  lists: [
    { title: 'Puces', value: 'bullet' },
    { title: 'Numeros', value: 'number' },
  ],
  marks: {
    decorators: [
      { title: 'Gras', value: 'strong' },
      { title: 'Italique', value: 'em' },
      { title: 'Code', value: 'code' },
    ],
    annotations: [
      {
        name: 'link',
        type: 'object',
        title: 'Lien',
        fields: [{ name: 'href', type: 'url', title: 'URL' }],
      },
    ],
  },
});
