import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * P31 - an unknown first segment (`/pricing`, `/de/about`) gets the branded 404,
 * because every page sits in `(site)`, whose layout refuses the segment below
 * `[locale]/not-found.tsx`. A page placed beside `(site)` instead of inside it
 * would escape the refusal: served at `/pricing/...` with HTTP 200, or refused
 * by the root layout where no boundary catches it.
 */
const LOCALE_ROOT = __dirname;
const SITE = join(LOCALE_ROOT, '(site)');

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

describe('P31 - every page refuses an unknown locale below the branded 404', () => {
  it('every page lives in the (site) group', () => {
    const outside = walk(LOCALE_ROOT)
      .filter((f) => f.endsWith('/page.tsx') && !f.startsWith(`${SITE}/`))
      .map((f) => relative(LOCALE_ROOT, f));
    expect(outside).toEqual([]);
  });

  it('the (site) layout is the refusal', () => {
    const layout = join(SITE, 'layout.tsx');
    expect(existsSync(layout)).toBe(true);
    expect(readFileSync(layout, 'utf8')).toMatch(
      /if \(!hasLocale\(routing\.locales, locale\)\) notFound\(\);/,
    );
  });

  it('the root layout does not refuse, because nothing above it could render the 404', () => {
    // A call, not a mention: the comment explaining why is allowed to name it.
    const calls = readFileSync(join(LOCALE_ROOT, 'layout.tsx'), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line) && /\bnotFound\(/.test(line));
    expect(calls).toEqual([]);
  });
});
