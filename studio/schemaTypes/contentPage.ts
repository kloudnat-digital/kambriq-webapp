import { defineField, defineType } from 'sanity';
import { richTextBlock } from './richText';

/**
 * The editorial pages, mirroring `CONTENT_PAGE_SLUGS` in
 * `libs/common/src/cms/content-page.ts`. The two are pinned against each other
 * by `studio-schema-matches-the-contract.spec.ts`, because this project has its
 * own install and cannot import that one.
 */
export const CONTENT_PAGE_SLUGS = ['about', 'methode', 'plan', 'verify'] as const;

/** Mirrors `CONTENT_PAGE_LANGUAGES`. Each language is its own document. */
export const CONTENT_PAGE_LANGUAGES = ['fr', 'en'] as const;

/** Mirrors `contentPageDocumentId`. Eight documents exist and no more. */
export const contentPageDocumentId = (slug: string, language: string) =>
  `contentPage-${slug}-${language}`;

export const contentPage = defineType({
  name: 'contentPage',
  title: 'Page editoriale',
  type: 'document',
  /**
   * No `title` field, deliberately. A policy has one because its first line is
   * its title; an editorial page sits under a hero whose heading comes from the
   * translation files, so a title here would be either a second copy of that or
   * a value nobody fills.
   */
  fields: [
    defineField({
      name: 'slug',
      title: 'Page',
      type: 'string',
      /**
       * Read-only and set by the template the structure item carries. It is part
       * of the document id, so changing it here would move the page without
       * moving the document and the site would go on reading the old id.
       */
      readOnly: true,
      options: { list: CONTENT_PAGE_SLUGS.map((value) => ({ title: value, value })) },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'language',
      title: 'Langue',
      type: 'string',
      readOnly: true,
      options: { list: CONTENT_PAGE_LANGUAGES.map((value) => ({ title: value, value })) },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'body',
      title: 'Contenu',
      type: 'array',
      /**
       * Mirrors `CONTENT_BLOCK_TYPES`. Every type here needs a renderer in
       * `apps/web/src/components/cms/portable-text.tsx`, which throws on one it
       * does not know rather than rendering the page with a section missing.
       */
      of: [richTextBlock, { type: 'divider' }, { type: 'labelDefinitions' }, { type: 'table' }],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: { slug: 'slug', language: 'language' },
    prepare: ({ slug, language }) => ({ title: slug, subtitle: language }),
  },
});
