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
 * a page added next month is covered without anybody remembering it. The MDX
 * content is read the same way: every file under `src/content`.
 */
const EXEMPT_NAMESPACES: Record<string, string> = {};

const MARKED = /\b(LANDS|VERIFY|KAMNET)\b(?!™)/g;
const URL = /https?:\/\/\S+|\/[\w/-]*\w/g;

/** Each product name missing its mark, outside URLs and paths. */
export const unmarked = (text: string): string[] =>
  [...text.replace(URL, ' ').matchAll(MARKED)].map((m) => m[1]);

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
const MDX = walk(join(__dirname, '..', 'content')).filter((f) => f.endsWith('.mdx'));

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

  it('every product name in the MDX content carries its mark', () => {
    expect(MDX.length).toBeGreaterThan(8);
    const found = MDX.flatMap((f) =>
      unmarked(readFileSync(f, 'utf8')).map((name) => `${f.split('/src/')[1]}: ${name}`),
    );
    expect(found).toEqual([]);
  });
});
