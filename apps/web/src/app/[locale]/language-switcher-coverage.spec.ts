import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/**
 * J4 / P16 - every public page offers the language switch.
 *
 * `QuickActions` carries the only language control, and it is mounted page by
 * page. It was on 8 of the public pages; `/contact`, `/about`, `/faq`, the four
 * legal pages and the certificate verdict had none. Since wave 5 the language is
 * in the URL, so an English visitor who landed on `/fr/contact` from a search
 * result had no way out of French.
 *
 * Every page under `app/[locale]` outside the signed-in `(app)` and `(auth)`
 * groups must render it - in the page or in a layout above it - unless it is
 * declared below with its reason. A page added next month is covered the day it
 * is written.
 */
const LOCALE_ROOT = join(__dirname);

const EXEMPT: Record<string, string> = {
  '[...rest]/page.tsx': 'the catch-all only calls notFound(); the branded 404 is the boundary',
  'kamnet/apply/page.tsx': 'behind the login wall - a signed-in page, not the public chrome',
};

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

const PUBLIC_PAGES = walk(LOCALE_ROOT)
  .filter((f) => f.endsWith('/page.tsx'))
  .map((f) => relative(LOCALE_ROOT, f))
  .filter((f) => !f.startsWith('(app)/') && !f.startsWith('(auth)/'));

/** The page itself, then every layout between it and `app/[locale]`. */
const chain = (page: string): string[] => {
  const files = [join(LOCALE_ROOT, page)];
  for (
    let dir = dirname(join(LOCALE_ROOT, page));
    dir.startsWith(LOCALE_ROOT);
    dir = dirname(dir)
  ) {
    const layout = join(dir, 'layout.tsx');
    if (dir !== LOCALE_ROOT && existsSync(layout)) files.push(layout);
    if (dir === LOCALE_ROOT) break;
  }
  return files;
};

const rendersSwitcher = (page: string) =>
  chain(page).some((f) => /<QuickActions\b/.test(readFileSync(f, 'utf8')));

describe('J4 / P16 - the language switch on every public page', () => {
  it('reads the public pages, not a list', () => {
    expect(PUBLIC_PAGES.length).toBeGreaterThan(15);
    expect(PUBLIC_PAGES).toContain('contact/page.tsx');
  });

  it('every public page renders QuickActions, itself or through a layout', () => {
    const missing = PUBLIC_PAGES.filter((p) => !(p in EXEMPT) && !rendersSwitcher(p));
    expect(missing).toEqual([]);
  });

  it('every exemption names a page that exists', () => {
    expect(Object.keys(EXEMPT).filter((p) => !PUBLIC_PAGES.includes(p))).toEqual([]);
  });
});
