import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const APP_DIR = join(__dirname, '..', '..', '..', '..', '..', 'apps', 'web', 'src', 'app');
const LOCALE_SEGMENT = '[locale]';

/** A route group, `(site)`, contributes nothing to the URL. */
const isRouteGroup = (segment: string): boolean => segment.startsWith('(') && segment.endsWith(')');

const walk = (dir: string, url: string[]): Array<[string, string]> =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      const next = isRouteGroup(entry.name) ? url : [...url, entry.name];
      return walk(join(dir, entry.name), next);
    }
    return entry.name === 'page.tsx'
      ? [[url.join('/'), join(dir, entry.name)] as [string, string]]
      : [];
  });

/**
 * Every localised page, keyed by the URL path it answers, without the locale.
 *
 * Read from disk rather than written down, because a page's parent directories
 * are not its URL: a route group is invisible in the URL by design, so a spec
 * that spells the path breaks the day somebody introduces one. Develop did
 * exactly that on 26 September, moving every page under `[locale]/(site)/`, and
 * two specs here asserted against `[locale]/about/page.tsx`.
 */
export const WEB_PAGES: ReadonlyMap<string, string> = new Map(
  walk(join(APP_DIR, LOCALE_SEGMENT), []),
);

/** The directory names under a URL prefix - `legal` gives its four policy pages. */
export const pagesUnder = (prefix: string): string[] =>
  [...WEB_PAGES.keys()]
    .filter((url) => url.startsWith(`${prefix}/`))
    .map((url) => url.slice(prefix.length + 1))
    .filter((rest) => !rest.includes('/'));
