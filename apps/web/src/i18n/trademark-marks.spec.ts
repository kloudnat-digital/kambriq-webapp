import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import fr from './messages/fr.json';
import en from './messages/en.json';
import { staleExemptions, watchedCopy } from './watched-namespaces';

/**
 * P27 - KAMBRIQ LANDS™, KAMBRIQ VERIFY™ and KAMNET™ carry the mark everywhere,
 * in both languages. KBS does not: it is a school, not a product mark (Visquis,
 * 25 September).
 *
 * Measured on develop before this: VERIFY carried it 20 times out of 21, LANDS
 * 0 out of 15, KAMNET 0 out of 53, in each language.
 *
 * Every namespace is watched unless declared exempt below - none is today - so
 * a page added next month is covered without anybody remembering it.
 *
 * Wave 7 moved the page content out of `src/content` into Sanity, so this rule
 * would have lost its only surface over long-form copy: a Sanity document cannot
 * be read by a test, and CI holds no token. What is read instead is the import
 * file the dataset was loaded from, which is the last version of that copy this
 * repository can see. It is not the live document, and that bound is the one case
 * this cannot catch: an editor changing copy in the Studio.
 */
const EXEMPT_NAMESPACES: Record<string, string> = {};

const MARKED = /\b(LANDS|VERIFY|KAMNET)\b(?!™)/g;
const URL = /https?:\/\/\S+|\/[\w/-]*\w/g;

/** Each product name missing its mark, outside URLs and paths. */
export const unmarked = (text: string): string[] =>
  [...text.replace(URL, ' ').matchAll(MARKED)].map((m) => m[1]);

const CMS_CONTENT = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'scripts',
  'sanity',
  'content',
  'initial-content.ndjson',
);

/** Every string a reader sees in a CMS document: block text, and the title fields. */
const cmsStrings = (): Array<[string, string]> => {
  const out: Array<[string, string]> = [];
  const collect = (id: string, node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach((child) => collect(id, child));
      return;
    }
    if (node === null || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'text' && typeof value === 'string') out.push([id, value]);
      else collect(id, value);
    }
  };
  for (const line of readFileSync(CMS_CONTENT, 'utf8').split('\n').filter(Boolean)) {
    const doc = JSON.parse(line) as Record<string, unknown>;
    const id = String(doc['_id']);
    collect(id, doc['body']);
    for (const field of ['title', 'summary', 'metaTitle', 'metaDescription']) {
      if (typeof doc[field] === 'string') out.push([`${id}.${field}`, doc[field] as string]);
    }
  }
  return out;
};

/**
 * P29 - the decision was about the mark, not about a surface: the API's own
 * catalogues, which write every email and notification, are read by the same
 * rule. Each file there is a namespace (`email`, `kamnet`, ...), watched unless
 * declared exempt - none is.
 */
const API_CATALOGUES = join(__dirname, '..', '..', '..', '..', 'libs', 'common', 'src', 'i18n');
const apiCatalogue = (locale: 'fr' | 'en') =>
  Object.fromEntries(
    readdirSync(join(API_CATALOGUES, locale))
      .filter((f) => f.endsWith('.json'))
      .map((f) => [
        f.replace(/\.json$/, ''),
        JSON.parse(readFileSync(join(API_CATALOGUES, locale, f), 'utf8')),
      ]),
  );
const API_EXEMPT_NAMESPACES: Record<string, string> = {};

describe('P27 - the product marks', () => {
  it('fails for the right reason: a missing mark, never a present one, a URL or a school', () => {
    expect(unmarked('KAMBRIQ LANDS et KAMNET')).toEqual(['LANDS', 'KAMNET']);
    expect(unmarked('KAMBRIQ LANDS™, KAMBRIQ VERIFY™ et KAMNET™')).toEqual([]);
    expect(unmarked('voir https://kambriq.com/LANDS et /products/KAMNET')).toEqual([]);
    expect(unmarked('KBS')).toEqual([]);
  });

  it('watches a namespace nobody has declared yet', () => {
    expect(
      watchedCopy({ ...fr, zzNewPage: { cta: 'Rejoignez KAMNET' } }, EXEMPT_NAMESPACES),
    ).toContainEqual(['zzNewPage.cta', 'Rejoignez KAMNET']);
  });

  it('declares no exemption for a namespace that does not exist', () => {
    expect(staleExemptions(fr, EXEMPT_NAMESPACES)).toEqual([]);
  });

  it.each([
    ['fr', fr],
    ['en', en],
  ] as const)('%s: every product name in the catalogue carries its mark', (_locale, messages) => {
    const found = watchedCopy(messages, EXEMPT_NAMESPACES)
      .filter(([, v]) => unmarked(v).length > 0)
      .map(([k, v]) => `${k} = ${v}`);
    expect(found).toEqual([]);
  });

  it.each([
    ['fr', fr],
    ['en', en],
  ] as const)('%s: no double mark, and none on KBS', (_locale, messages) => {
    const found = watchedCopy(messages, EXEMPT_NAMESPACES)
      .filter(([, v]) => /™\s*™|\bKBS™/.test(v))
      .map(([k, v]) => `${k} = ${v}`);
    expect(found).toEqual([]);
  });

  it.each(['fr', 'en'] as const)(
    '%s: every product name in the API catalogues - emails and notifications - carries its mark',
    (locale) => {
      const catalogue = apiCatalogue(locale);
      expect(Object.keys(catalogue)).toEqual(expect.arrayContaining(['email', 'kamnet']));
      expect(staleExemptions(catalogue, API_EXEMPT_NAMESPACES)).toEqual([]);
      const found = watchedCopy(catalogue, API_EXEMPT_NAMESPACES)
        .filter(([, v]) => unmarked(v).length > 0 || /™\s*™|\bKBS™/.test(v))
        .map(([k, v]) => `${k} = ${v}`);
      expect(found).toEqual([]);
    },
  );

  it('every product name in the CMS content carries its mark', () => {
    const strings = cmsStrings();
    // A reader that finds nothing makes the assertion below vacuous, which is
    // how this arm would have failed silently once the content moved.
    expect(strings.length).toBeGreaterThan(150);
    expect(new Set(strings.map(([id]) => id.split('.')[0])).size).toBe(16);

    const found = strings
      .filter(([, text]) => unmarked(text).length > 0)
      .map(([id, text]) => `${id}: ${unmarked(text).join(', ')} in "${text.slice(0, 60)}"`);
    expect(found).toEqual([]);
  });

  it('puts no mark on KBS and never doubles one, in the CMS content too', () => {
    const found = cmsStrings()
      .filter(([, text]) => /™\s*™|\bKBS™/.test(text))
      .map(([id, text]) => `${id}: ${text.slice(0, 60)}`);
    expect(found).toEqual([]);
  });
});
