import { defineConfig } from 'sanity';
import { structureTool, type StructureResolver } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schemaTypes } from './schemaTypes';
import { POLICY_LANGUAGES, POLICY_SLUGS, policyDocumentId } from './schemaTypes/legalPolicy';
import {
  CONTENT_PAGE_LANGUAGES,
  CONTENT_PAGE_SLUGS,
  contentPageDocumentId,
} from './schemaTypes/contentPage';

const projectId = process.env['SANITY_STUDIO_PROJECT_ID'];
const dataset = process.env['SANITY_STUDIO_DATASET'];

if (!projectId || !dataset) {
  throw new Error(
    'SANITY_STUDIO_PROJECT_ID and SANITY_STUDIO_DATASET must be set. Copy .env.example to .env.',
  );
}

/** One id per policy per language, so the set of documents is closed. */
const POLICY_DOCUMENTS = POLICY_SLUGS.flatMap((slug) =>
  POLICY_LANGUAGES.map((language) => ({ slug, language, id: policyDocumentId(slug, language) })),
);

/** The same for editorial pages. */
const CONTENT_DOCUMENTS = CONTENT_PAGE_SLUGS.flatMap((slug) =>
  CONTENT_PAGE_LANGUAGES.map((language) => ({
    slug,
    language,
    id: contentPageDocumentId(slug, language),
  })),
);

const POLICY_TEMPLATE_ID = 'legalPolicy-by-slug-language';
const CONTENT_TEMPLATE_ID = 'contentPage-by-slug-language';

/**
 * Every document is a fixed document listed by id rather than created.
 *
 * A collection would let an editor make a second French privacy policy, and the
 * archive would then hold two rows claiming to be the current version with
 * nothing to say which a consent record meant. Editorial pages are listed the
 * same way for the same reason one step down: the site fetches by id, so a
 * second document would be content nobody ever sees.
 */
const structure: StructureResolver = (S) =>
  S.list()
    .title('Contenu')
    .items([
      S.listItem()
        .id('pages')
        .title('Pages')
        .child(
          S.list()
            .title('Pages')
            .items(
              CONTENT_DOCUMENTS.map(({ slug, language, id }) =>
                S.listItem()
                  .id(id)
                  .title(`${slug} (${language})`)
                  .child(
                    S.document()
                      .schemaType('contentPage')
                      .documentId(id)
                      .title(`${slug} (${language})`)
                      .initialValueTemplate(CONTENT_TEMPLATE_ID, { slug, language }),
                  ),
              ),
            ),
        ),
      S.listItem()
        .id('legal')
        .title('Documents legaux')
        .child(
          S.list()
            .title('Documents legaux')
            .items(
              POLICY_DOCUMENTS.map(({ slug, language, id }) =>
                S.listItem()
                  .id(id)
                  .title(`${slug} (${language})`)
                  .child(
                    S.document()
                      .schemaType('legalPolicy')
                      .documentId(id)
                      .title(`${slug} (${language})`)
                      .initialValueTemplate(POLICY_TEMPLATE_ID, { slug, language }),
                  ),
              ),
            ),
        ),
    ]);

export default defineConfig({
  name: 'default',
  title: 'kambriq',
  projectId,
  dataset,
  plugins: [structureTool({ structure }), visionTool()],
  schema: {
    types: schemaTypes,
    /**
     * `slug` and `language` are read-only on the form, so a template is the only
     * thing that sets them. Its parameters come from the structure item, which
     * means they always agree with the document id.
     */
    templates: (prev) => [
      ...prev.filter(
        (template) =>
          template.schemaType !== 'legalPolicy' && template.schemaType !== 'contentPage',
      ),
      {
        id: POLICY_TEMPLATE_ID,
        title: 'Document legal',
        schemaType: 'legalPolicy',
        parameters: [
          { name: 'slug', type: 'string' },
          { name: 'language', type: 'string' },
        ],
        value: ({ slug, language }: { slug: string; language: string }) => ({ slug, language }),
      },
      {
        id: CONTENT_TEMPLATE_ID,
        title: 'Page editoriale',
        schemaType: 'contentPage',
        parameters: [
          { name: 'slug', type: 'string' },
          { name: 'language', type: 'string' },
        ],
        value: ({ slug, language }: { slug: string; language: string }) => ({ slug, language }),
      },
    ],
  },
  document: {
    /**
     * Removes both types from the global create menu. The structure is the only
     * way in, and it carries the id.
     */
    newDocumentOptions: (prev) =>
      prev.filter(
        (option) =>
          option.templateId !== POLICY_TEMPLATE_ID && option.templateId !== CONTENT_TEMPLATE_ID,
      ),
  },
});
