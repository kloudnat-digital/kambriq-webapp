import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'groq-js';
import { pagesUnder } from './web-pages';
import {
  CONTENT_BLOCK_DECORATORS,
  CONTENT_BLOCK_LISTS,
  CONTENT_BLOCK_STYLES,
  CONTENT_BLOCK_TYPES,
  CONTENT_PAGE_LANGUAGES,
  CONTENT_PAGE_SLUGS,
  CONTENT_PAGE_TYPE,
  DELIVERY_PROJECTION,
  LEGAL_POLICY_TYPE,
  POLICY_LANGUAGES,
  POLICY_PUBLISH_PROJECTION,
  POLICY_SLUGS,
} from '@kambriq/common';

/**
 * The Studio schema against the contract the API is built from.
 *
 * `studio/` is a separate project with its own install and its own lockfile, so
 * it cannot import `libs/common` and its constants are copies. The copies are
 * read here as text rather than imported, because importing the schema would
 * pull in `sanity`, which this workspace deliberately does not install.
 *
 * The fields are not listed here a third time. They are the attributes the
 * projection reads, taken from its parsed GROQ, so this file has no opinion of
 * its own about what the document carries.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SCHEMA = readFileSync(join(ROOT, 'studio/schemaTypes/legalPolicy.ts'), 'utf8');
const CONTENT_SCHEMA = readFileSync(join(ROOT, 'studio/schemaTypes/contentPage.ts'), 'utf8');
const SCHEMA_INDEX = readFileSync(join(ROOT, 'studio/schemaTypes/index.ts'), 'utf8');
const RICH_TEXT = readFileSync(join(ROOT, 'studio/schemaTypes/richText.ts'), 'utf8');

/**
 * The `value: 'x'` entries under one key of the block definition.
 *
 * The array is found by balancing brackets rather than by a regex ending at a
 * fixed indentation: `decorators` is nested inside `marks`, and a pattern
 * written for the outer level silently matched nothing. It throws when it finds
 * nothing, because an extraction that returns an empty list passes every
 * comparison below by being empty on both sides.
 */
const offered = (key: string): string[] => {
  const start = RICH_TEXT.indexOf(`${key}: [`);
  if (start < 0) throw new Error(`studio/schemaTypes/richText.ts declares no ${key}`);

  let depth = 0;
  let end = start;
  for (let i = RICH_TEXT.indexOf('[', start); i < RICH_TEXT.length; i += 1) {
    if (RICH_TEXT[i] === '[') depth += 1;
    if (RICH_TEXT[i] === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  const values = [...RICH_TEXT.slice(start, end).matchAll(/value: '([^']+)'/g)].map(
    (match) => match[1] as string,
  );
  if (values.length === 0) throw new Error(`studio/schemaTypes/richText.ts offers no ${key}`);
  return values;
};

/** The document attributes a projection reads, excluding Sanity's own. */
const projectedFields = (projection: string = POLICY_PUBLISH_PROJECTION): string[] => {
  const tree = parse(`*[true]${projection}`) as unknown as {
    expr: { expr: { attributes: { value: { type: string; name?: string } }[] } };
  };
  return tree.expr.expr.attributes
    .map((attribute) => attribute.value)
    .filter((value) => value.type === 'AccessAttribute' && !value.name?.startsWith('_'))
    .map((value) => value.name as string);
};

/** The names declared by `defineField` calls, in order. */
const declaredFields = (schema: string = SCHEMA): string[] =>
  schema
    .split('defineField(')
    .slice(1)
    .map((chunk) => /name: '([^']+)'/.exec(chunk)?.[1])
    .filter((name): name is string => Boolean(name));

/** A `['a', 'b'] as const` array exported under this name. */
const declaredList = (name: string, schema: string = SCHEMA): string[] => {
  const block = new RegExp(`export const ${name} = \\[([^\\]]*)\\]`).exec(schema)?.[1];
  if (block === undefined) throw new Error(`the Studio schema declares no ${name}`);
  return [...block.matchAll(/'([^']+)'/g)].map((match) => match[1] as string);
};

describe('the Studio schema and the API contract', () => {
  it('found something to check, so the assertions below mean something', () => {
    // An extraction that silently matched nothing passes every comparison that
    // follows by being empty on both sides.
    expect(declaredFields().length).toBeGreaterThan(3);
    expect(projectedFields().length).toBeGreaterThan(0);
  });

  it('declares the document type the archive accepts', () => {
    expect(SCHEMA).toContain(`name: '${LEGAL_POLICY_TYPE}'`);
  });

  it('carries every field the projection reads', () => {
    expect(declaredFields()).toEqual(expect.arrayContaining(projectedFields()));
  });

  it('offers the same policies as the contract', () => {
    expect(declaredList('POLICY_SLUGS')).toEqual([...POLICY_SLUGS]);
  });

  it('offers the same languages as the contract', () => {
    expect(declaredList('POLICY_LANGUAGES')).toEqual([...POLICY_LANGUAGES]);
  });

  it('names only policies the site has a page for', () => {
    // A slug with no page is a document an editor can publish and nobody can
    // read, and the Studio gives no sign of it.
    // Looked up by the URL each page answers, not by a path spelled out here: a
    // route group changes the directories and not the URL. See web-pages.ts.
    const pages = pagesUnder('legal').map((name) => `legal-${name}`);

    expect(pages.length).toBeGreaterThan(3);
    expect(pages).toEqual(expect.arrayContaining([...POLICY_SLUGS]));
  });

  describe('the editorial pages', () => {
    it('found something to check, so the assertions below mean something', () => {
      expect(declaredFields(CONTENT_SCHEMA).length).toBeGreaterThan(2);
      expect(projectedFields(DELIVERY_PROJECTION).length).toBeGreaterThan(0);
    });

    it('declares the document type delivery asks for', () => {
      expect(CONTENT_SCHEMA).toContain(`name: '${CONTENT_PAGE_TYPE}'`);
    });

    it('offers the same pages as the contract', () => {
      expect(declaredList('CONTENT_PAGE_SLUGS', CONTENT_SCHEMA)).toEqual([...CONTENT_PAGE_SLUGS]);
    });

    it('offers the same languages as the contract', () => {
      expect(declaredList('CONTENT_PAGE_LANGUAGES', CONTENT_SCHEMA)).toEqual([
        ...CONTENT_PAGE_LANGUAGES,
      ]);
    });

    it('builds the document id the same way delivery does', () => {
      // Delivery fetches by id. An id built differently in the two places is a
      // document an editor writes and the site never finds, with nothing to say
      // so on either side.
      expect(CONTENT_SCHEMA).toContain('`contentPage-${slug}-${language}`');
      expect(SCHEMA).toContain('`legalPolicy-${slug}-${language}`');
    });

    it('allows exactly the block types the contract declares', () => {
      // Every one of them needs a renderer in apps/web, which throws on a type
      // it does not know. A type added here and nowhere else is a page that
      // stops rendering the moment an editor uses it.
      const allowed = [...(CONTENT_BLOCK_TYPES as readonly string[])]
        .filter((type) => type !== 'block')
        .sort();
      const inSchema = [...CONTENT_SCHEMA.matchAll(/\{ type: '([^']+)' \}/g)]
        .map((match) => match[1] as string)
        .filter((type) => type !== 'block' && type !== 'string')
        .sort();

      expect(inSchema).toEqual(allowed);
      expect(inSchema.length).toBeGreaterThan(0);
    });

    it('registers every type the Studio needs, so the schema compiles', () => {
      for (const type of CONTENT_BLOCK_TYPES) {
        if (type === 'block') continue;
        expect(SCHEMA_INDEX).toContain(type);
      }
      expect(SCHEMA_INDEX).toContain(CONTENT_PAGE_TYPE);
    });
  });

  describe('what an editor is offered', () => {
    /**
     * These lists are the guard. `@portabletext/react` merges its own default
     * components under ours, so a style the site does not style renders as an
     * unstyled heading and never reaches `onMissingComponent` - measured in
     * `apps/web/src/components/cms/portable-text.spec.tsx`. Nothing at render
     * time can refuse it, so the editor is not offered it.
     */
    it('offers exactly the block styles the site styles', () => {
      expect(offered('styles')).toEqual([...CONTENT_BLOCK_STYLES]);
    });

    it('offers exactly the marks the site renders', () => {
      expect(offered('decorators')).toEqual([...CONTENT_BLOCK_DECORATORS]);
    });

    it('offers exactly the list kinds the site renders', () => {
      expect(offered('lists')).toEqual([...CONTENT_BLOCK_LISTS]);
    });

    it('does not offer h1, because the page already has one', () => {
      // A policy's title is a field; an editorial page's heading comes from the
      // translation files. A second top-level heading is a defect, not a taste.
      expect(offered('styles')).not.toContain('h1');
    });

    it('uses the one block definition for both document types', () => {
      // Two copies would drift, and the drift would be invisible: each schema
      // would look complete on its own.
      expect(SCHEMA).toContain('of: [richTextBlock]');
      expect(CONTENT_SCHEMA).toContain('of: [richTextBlock,');
    });
  });
});
