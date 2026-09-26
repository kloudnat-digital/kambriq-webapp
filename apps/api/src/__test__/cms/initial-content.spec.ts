import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONTENT_BLOCK_DECORATORS,
  CONTENT_BLOCK_LISTS,
  CONTENT_BLOCK_STYLES,
  CONTENT_BLOCK_TYPES,
  CONTENT_PAGE_LANGUAGES,
  CONTENT_PAGE_ROUTES,
  CONTENT_PAGE_SLUGS,
  POLICY_LANGUAGES,
  POLICY_SLUGS,
  contentPageDocumentId,
  policyDocumentId,
} from '@kambriq/common';
import { renderPolicyHtml, type PolicyBody } from '../../cms/policy-render';

/**
 * The wave 7 import file: the content the site used to compile from mdx.
 *
 * It is committed, and it is the CONTENT rather than a record of what the CMS
 * holds. Once an editor publishes, the dataset is the content and this file is
 * the state it started from.
 *
 * What this pins is the part a later change can quietly break: that every
 * document the contract declares is in the file, under the id delivery asks
 * for, carrying only block types something can render.
 *
 * It is the file's ONLY guard. The converter and the build script that produced
 * it were deleted with the markdown they read, so the file can no longer be
 * re-derived from its sources and compared byte for byte; that derivation was
 * checked once, and the register holds the result.
 */
const ROOT = join(__dirname, '../../../../..');

interface ImportedDocument {
  _type: string;
  title?: string;
  /** Loose on purpose: the file is data, and what each node carries is what is asserted. */
  body: { _type: string; [key: string]: unknown }[];
}

const DOCUMENTS: Record<string, ImportedDocument> = Object.fromEntries(
  readFileSync(join(ROOT, 'scripts/sanity/content/initial-content.ndjson'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => {
      const document = JSON.parse(line);
      return [document._id, document];
    }),
);

describe('wave 7 - the content the migration produced', () => {
  it('carries every policy the contract declares, in every language', () => {
    for (const slug of POLICY_SLUGS) {
      for (const language of POLICY_LANGUAGES) {
        const document = DOCUMENTS[policyDocumentId(slug, language)];
        expect(document).toBeDefined();
        expect(document?._type).toBe('legalPolicy');
        // The title is a field, so the page renders one heading rather than
        // printing the body's first line under it.
        expect(document?.title?.length).toBeGreaterThan(3);
      }
    }
  });

  it('carries every editorial page the contract declares, in every language', () => {
    for (const slug of CONTENT_PAGE_SLUGS) {
      for (const language of CONTENT_PAGE_LANGUAGES) {
        const document = DOCUMENTS[contentPageDocumentId(slug, language)];
        expect(document).toBeDefined();
        expect(document?._type).toBe('contentPage');
      }
    }
  });

  it('holds exactly those documents and no others', () => {
    // Sixteen. A stray id would be a document the Studio's structure cannot
    // open and nothing on the site fetches - content nobody can reach.
    const expected = [
      ...POLICY_SLUGS.flatMap((slug) => POLICY_LANGUAGES.map((l) => policyDocumentId(slug, l))),
      ...CONTENT_PAGE_SLUGS.flatMap((slug) =>
        CONTENT_PAGE_LANGUAGES.map((l) => contentPageDocumentId(slug, l)),
      ),
    ];
    expect(Object.keys(DOCUMENTS).sort()).toEqual(expected.sort());
  });

  it('uses only block types the contract declares', () => {
    for (const [id, document] of Object.entries(DOCUMENTS)) {
      const types = [...new Set(document.body.map((node) => node._type))];
      for (const type of types) {
        expect({ id, type }).toMatchObject({
          type: expect.stringMatching(
            new RegExp(`^(${(CONTENT_BLOCK_TYPES as readonly string[]).join('|')})$`),
          ),
        });
      }
    }
  });

  it('keeps policies to plain blocks, because that is all the archive renders', () => {
    // `policy-render.ts` throws on a type it does not know. A policy carrying a
    // divider or a table would be published, refused by the archive, and the
    // failure would arrive as a 400 in Sanity's attempt log rather than here.
    for (const slug of POLICY_SLUGS) {
      for (const language of POLICY_LANGUAGES) {
        const document = DOCUMENTS[policyDocumentId(slug, language)];
        expect(document?.body.every((node) => node._type === 'block')).toBe(true);
      }
    }
  });

  it('renders every policy through the archive renderer without a refusal', () => {
    // The whole point of the strict renderer, run against the real content: if
    // the migration had produced a node the archive cannot reproduce, the first
    // publish would have been the place we found out.
    for (const slug of POLICY_SLUGS) {
      for (const language of POLICY_LANGUAGES) {
        const document = DOCUMENTS[policyDocumentId(slug, language)];
        const html = renderPolicyHtml(document?.body as unknown as PolicyBody);
        expect(html).toContain('<p>');
        expect(html).not.toContain('display:none');
      }
    }
  });

  it('puts the three labels in one block on the methode page, in both languages', () => {
    // The labels are fields in libs/common, not prose. The converter refused to
    // run until the constants reproduced the markdown character for character.
    for (const language of CONTENT_PAGE_LANGUAGES) {
      const document = DOCUMENTS[contentPageDocumentId('methode', language)];
      const labels = document?.body.filter((node) => node._type === 'labelDefinitions');
      expect(labels).toHaveLength(1);
    }
  });

  it('keeps the VERIFY price table as a table, not as sentences', () => {
    for (const language of CONTENT_PAGE_LANGUAGES) {
      const document = DOCUMENTS[contentPageDocumentId('verify', language)];
      const table = document?.body.find((node) => node._type === 'table') as unknown as
        | { columns: string[]; rows: { cells: string[] }[] }
        | undefined;
      expect(table?.columns).toHaveLength(2);
      expect(table?.rows).toHaveLength(2);
      expect(table?.rows.flatMap((row) => row.cells).join(' ')).toMatch(/99/);
    }
  });

  it('has a page on disk for every editorial slug', () => {
    // A slug with no page is content nobody can reach, and an editor cannot
    // tell by looking at the Studio.
    for (const [slug, route] of Object.entries(CONTENT_PAGE_ROUTES)) {
      const page = join(ROOT, 'apps/web/src/app/[locale]', route, 'page.tsx');
      expect({ slug, exists: readFileSync(page, 'utf8').length > 0 }).toEqual({
        slug,
        exists: true,
      });
    }
  });

  it('uses only the styles, marks and lists an editor is offered', () => {
    // The migration ran before those lists existed. If it produced a style the
    // Studio no longer offers, an editor opening that document would be shown a
    // value they cannot choose again - and the site would render it unstyled.
    const styles = new Set<string>();
    const marks = new Set<string>();
    const lists = new Set<string>();

    for (const document of Object.values(DOCUMENTS)) {
      for (const node of document.body) {
        if (node._type !== 'block') continue;
        styles.add(node['style'] as string);
        if (node['listItem']) lists.add(node['listItem'] as string);
        for (const child of (node['children'] ?? []) as { marks?: string[] }[]) {
          for (const mark of child.marks ?? []) marks.add(mark);
        }
      }
    }

    expect([...styles].sort()).toEqual(
      expect.arrayContaining([]) &&
        [...styles].filter((s) => (CONTENT_BLOCK_STYLES as readonly string[]).includes(s)).sort(),
    );
    expect(
      [...marks].every((m) => (CONTENT_BLOCK_DECORATORS as readonly string[]).includes(m)),
    ).toBe(true);
    expect([...lists].every((l) => (CONTENT_BLOCK_LISTS as readonly string[]).includes(l))).toBe(
      true,
    );
    // It found something: an empty sweep passes every check above.
    expect(styles.size).toBeGreaterThan(1);
  });

  describe('no dots in document ids', () => {
    /**
     * In a PUBLIC dataset Sanity treats any document whose `_id` contains a
     * period as private - the same rule that hides `drafts.*` - so a dotted id
     * is readable only with a token, and the delivery client deliberately sends
     * none.
     *
     * This cost a full round trip to find. The first id scheme was
     * `legalPolicy.legal-privacy.fr`: the import succeeded, the Studio listed
     * all sixteen documents with their content, `sanity documents query` showed
     * them, and every page on the site answered 404 - because the only caller
     * without a token saw an empty dataset. Proved with a control rather than
     * from the documentation: a dotless document written into the same dataset
     * was readable anonymously in the same second that a dotted one was not.
     */
    const dotted = (id: string) => id.includes('.');

    it('the id the contract builds carries no dot', () => {
      for (const slug of POLICY_SLUGS) {
        for (const language of POLICY_LANGUAGES) {
          expect({ id: policyDocumentId(slug, language) }).toEqual({
            id: expect.not.stringContaining('.'),
          });
        }
      }
      for (const slug of CONTENT_PAGE_SLUGS) {
        for (const language of CONTENT_PAGE_LANGUAGES) {
          expect({ id: contentPageDocumentId(slug, language) }).toEqual({
            id: expect.not.stringContaining('.'),
          });
        }
      }
    });

    it('no document in the import file carries one either', () => {
      const offenders = Object.keys(DOCUMENTS).filter(dotted);
      expect(offenders).toEqual([]);
      // It found something: an empty file passes the line above.
      expect(Object.keys(DOCUMENTS).length).toBe(16);
    });
  });
});
