import { defineField, defineType } from 'sanity';
import { richTextBlock } from './richText';

/**
 * The slugs this Studio may publish, and the only ones the site serves.
 *
 * Mirrors `POLICY_SLUGS` in `libs/common/src/cms/legal-policy.ts`. The two are
 * pinned against each other by `studio-schema-matches-the-contract.spec.ts`,
 * because this project has its own install and cannot import from that one.
 */
export const POLICY_SLUGS = [
  'legal-mentions',
  'legal-privacy',
  'legal-rgpd',
  'legal-terms',
] as const;

/** Mirrors `POLICY_LANGUAGES`. Each language is its own document. */
export const POLICY_LANGUAGES = ['fr', 'en'] as const;

/**
 * The id of the one document holding a policy in a language.
 *
 * Eight documents exist and no more: the structure opens each by id, so an
 * editor cannot create a second `legal-privacy` in French and leave the archive
 * with two rows claiming to be the current version.
 */
export const policyDocumentId = (slug: string, language: string) =>
  `legalPolicy-${slug}-${language}`;

export const legalPolicy = defineType({
  name: 'legalPolicy',
  title: 'Document legal',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Titre',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Document',
      type: 'string',
      /**
       * Read-only and set by the template that creates the document. It is part
       * of the document id, and changing it here would move the policy without
       * moving the document, leaving the archive keyed on one and the site
       * reading the other.
       */
      readOnly: true,
      options: { list: POLICY_SLUGS.map((value) => ({ title: value, value })) },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'language',
      title: 'Langue',
      type: 'string',
      readOnly: true,
      options: { list: POLICY_LANGUAGES.map((value) => ({ title: value, value })) },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'publishedAt',
      title: 'En vigueur a partir du',
      type: 'datetime',
      /**
       * The date the wording takes effect, chosen by whoever publishes it - not
       * the moment Sanity stored it. Consent records ask which version was
       * current at a given date, and that is this field.
       */
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'body',
      title: 'Texte',
      type: 'array',
      of: [richTextBlock],
      /**
       * Blocks only. Every block type here needs a renderer in
       * `apps/api/src/cms/policy-render.ts`, which throws on one it does not
       * know rather than dropping it from the archive.
       */
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: { title: 'title', slug: 'slug', language: 'language' },
    prepare: ({ title, slug, language }) => ({
      title: title ?? slug,
      subtitle: `${slug} (${language})`,
    }),
  },
});
