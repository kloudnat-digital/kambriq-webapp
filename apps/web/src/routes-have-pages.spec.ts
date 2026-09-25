import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { AUTH_ROUTES, PUBLIC_PATHS } from './routes';

/**
 * A route the middleware lets through must have something behind it.
 *
 * `/reactivate` was in PUBLIC_PATHS with no page. `lib/actions/auth.ts`
 * redirects there when the API answers REACTIVATION_REQUIRED, so a user in the
 * soft-delete grace period - somebody trying to undo a deletion, on a clock -
 * was sent to a 404. Nothing failed: the middleware did exactly what the list
 * told it, and the list was right. The page was missing.
 *
 * `isPublic` and `proxy` are already covered. Both answer "is this path
 * public?", and both would have gone on answering "yes" for a path that renders
 * nothing. This asserts the other half: that the answer leads somewhere.
 */
const APP_DIR = join(__dirname, 'app');

/** The directory that carries the locale, dropped when computing a URL path. */
const LOCALE_SEGMENT = '[locale]';

/**
 * Entries that are prefixes rather than pages, declared rather than inferred.
 *
 * `/legal`, `/products` and `/verify-certificate` have no index page. `isPublic`
 * matches `p` or `p + '/'`, so the bare entry is what makes `/legal/privacy`,
 * `/terms`, `/mentions` and `/rgpd` public. Removing them would send four legal
 * pages to the login screen. They are listed here so that a NEW pathless entry
 * fails the test instead of being quietly absorbed by the exception.
 */
const PREFIX_ONLY = ['/legal', '/products', '/verify-certificate'];

/** Every URL path that has a `page.tsx`, with Next route groups `(x)` removed. */
const collectRoutes = (dir: string, urlPath = ''): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // `(auth)` and `(app)` group files without contributing a path segment;
      // `@slot` and `_private` never appear in a URL either.
      //
      // `[param]` is NOT in that set - a dynamic segment is a real path segment.
      // The first version of this line stripped it, and the test failed on
      // `/verify-certificate` "having no child page" when it has
      // `[certificateNumber]/page.tsx`. That was a defect in the measurement
      // reported as a defect in the thing measured, which is this project's
      // house speciality; the failure is left recorded here rather than tidied
      // away.
      //
      // `[locale]` is the one dynamic segment that IS dropped, and it is named
      // rather than pattern-matched. It carries the language, so `PUBLIC_PATHS`
      // and every other list in `routes.ts` is written without it; a second
      // dynamic segment at the root would be a real path segment again and has
      // to fail here rather than be absorbed.
      const segment = entry === LOCALE_SEGMENT || /^[(@_]/.test(entry) ? '' : `/${entry}`;
      out.push(...collectRoutes(full, urlPath + segment));
    } else if (entry === 'page.tsx' || entry === 'page.ts') {
      out.push(urlPath === '' ? '/' : urlPath);
    }
  }
  return out;
};

const ROUTES = collectRoutes(APP_DIR);

describe('public routes resolve to a page', () => {
  it('found the app router pages at all', () => {
    // A collector that returns nothing would make every assertion below vacuous
    // - the measurement failing silently rather than the thing measured.
    expect(ROUTES.length).toBeGreaterThan(20);
    expect(ROUTES).toContain('/login');
  });

  it.each(PUBLIC_PATHS.filter((p) => !PREFIX_ONLY.includes(p)))(
    'public path %s has a page',
    (p) => {
      expect(ROUTES).toContain(p);
    },
  );

  it.each(PREFIX_ONLY)('prefix-only path %s has at least one child page', (prefix) => {
    // A prefix that leads nowhere is the same defect wearing a different hat.
    expect(ROUTES.filter((r) => r.startsWith(`${prefix}/`))).not.toHaveLength(0);
  });

  it.each(Object.entries(AUTH_ROUTES))(
    'auth route %s (%s) is public, so the redirect does not bounce to login',
    (_name, path) => {
      expect(PUBLIC_PATHS).toContain(path);
    },
  );
});
