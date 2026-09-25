import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { routing } from '@/i18n/routing';
import { PROTECTED_PREFIXES, PUBLIC_PATHS } from '@/routes';
import { INDEXABLE_PAGES, NOT_INDEXABLE, PAGE_WEIGHT } from './pages';
import { siteJsonLd } from './json-ld';

/**
 * Validates sitemap and robots.txt generation.
 * Guards against environment misconfigurations (relying strictly on `APP_ENV` over `NODE_ENV`)
 * to prevent staging sites from being indexed and crawling regressions.
 */
const PRODUCTION = { APP_ENV: 'production' };

const withEnv = <T>(env: Record<string, string>, fn: () => T): T => {
  const original = { ...process.env };
  Object.assign(process.env, env);
  try {
    return fn();
  } finally {
    for (const key of Object.keys(env)) delete process.env[key];
    Object.assign(process.env, original);
  }
};

/** Every URL path with a page, with route groups and the locale dropped. */
const APP_DIR = join(__dirname, '..', '..', 'app');
const collect = (dir: string, url = ''): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const segment = entry === '[locale]' || /^[(@_]/.test(entry) ? '' : `/${entry}`;
      return collect(full, url + segment);
    }
    return entry === 'page.tsx' ? [url === '' ? '/' : url] : [];
  });
const ROUTES = collect(APP_DIR);

describe('the sitemap', () => {
  it('is reading the routes it thinks it is', () => {
    // A walk that found nothing would make the inventory assertions vacuous.
    expect(ROUTES.length).toBeGreaterThan(50);
    expect(ROUTES).toContain('/about');
  });

  it('lists nothing at all outside production', () => {
    /** Enforces empty sitemaps for non-production environments to prevent staging site indexing. */
    expect(withEnv({ APP_ENV: 'dev' }, sitemap)).toEqual([]);
    expect(withEnv({ APP_ENV: '' }, sitemap)).toEqual([]);
  });

  it('lists every indexable page once per locale, absolutely', () => {
    const entries = withEnv(PRODUCTION, sitemap);

    expect(entries).toHaveLength(INDEXABLE_PAGES.length * routing.locales.length);
    for (const entry of entries) {
      expect(entry.url).toMatch(/^https?:\/\//);
      expect(entry.url).toMatch(/\/(fr|en)(\/|$)/);
    }
  });

  it('gives every entry its alternates, in both languages plus x-default', () => {
    // Ensures bidirectional alternate links for localized content to maintain correct indexing.
    for (const entry of withEnv(PRODUCTION, sitemap)) {
      const languages = entry.alternates?.languages ?? {};
      expect(Object.keys(languages).sort()).toEqual(['en', 'fr', 'x-default']);
    }
  });

  it('offers no page that requires a session', () => {
    // Prevents authenticated routes from polluting the sitemap, avoiding crawl budget waste and soft 404s.
    const offered = withEnv(PRODUCTION, sitemap).map((e) => new URL(e.url).pathname);
    const behindAuth = offered.filter((path) =>
      PROTECTED_PREFIXES.some((prefix) =>
        routing.locales.some(
          (l) => path === `/${l}${prefix}` || path.startsWith(`/${l}${prefix}/`),
        ),
      ),
    );
    expect(behindAuth).toEqual([]);
  });

  it('states a priority and a frequency for every page it lists', () => {
    // Requires explicit priorities to prevent unintended 0.5 defaults across disparate pages.
    for (const path of INDEXABLE_PAGES) {
      expect(PAGE_WEIGHT[path]).toBeDefined();
    }
  });
});

describe('the indexable inventory', () => {
  it('every listed page exists on disk', () => {
    const missing = INDEXABLE_PAGES.filter((path) => !ROUTES.includes(path));
    expect(missing).toEqual([]);
  });

  it('every public page is either listed or excluded with a reason', () => {
    /** Enforces bidirectional synchronization between public routes and the indexable inventory. */
    const publicRoutes = ROUTES.filter((route) =>
      PUBLIC_PATHS.some((p) => route === p || route.startsWith(`${p}/`)),
    );

    const unaccounted = publicRoutes.filter(
      (route) =>
        !(INDEXABLE_PAGES as readonly string[]).includes(route) &&
        !Object.keys(NOT_INDEXABLE).some((p) => route === p || route.startsWith(`${p}/`)),
    );
    expect(unaccounted).toEqual([]);
  });

  it('every exclusion names a page that exists, and gives a reason', () => {
    // Validates exclusions against existing routes to prevent stale omission rules.
    for (const [path, reason] of Object.entries(NOT_INDEXABLE)) {
      expect(reason.length).toBeGreaterThan(10);
      expect(ROUTES.some((r) => r === path || r.startsWith(`${path}/`))).toBe(true);
    }
  });
});

describe('robots.txt', () => {
  it('refuses everything outside production', () => {
    expect(withEnv({ APP_ENV: 'dev' }, robots)).toEqual({
      rules: { userAgent: '*', disallow: '/' },
    });
    expect(withEnv({}, robots).rules).toEqual({ userAgent: '*', disallow: '/' });
  });

  it('disallows every protected prefix, in both locales and unprefixed', () => {
    const { rules } = withEnv(PRODUCTION, robots);
    const disallow = (Array.isArray(rules) ? [] : ((rules.disallow as string[]) ?? [])).map(String);

    for (const prefix of PROTECTED_PREFIXES) {
      expect(disallow).toContain(`${prefix}/`);
      for (const locale of routing.locales) expect(disallow).toContain(`/${locale}${prefix}/`);
    }
  });

  it('disallows the public pages that answer no search', () => {
    const { rules } = withEnv(PRODUCTION, robots);
    const disallow = (Array.isArray(rules) ? [] : ((rules.disallow as string[]) ?? [])).map(String);

    for (const path of Object.keys(NOT_INDEXABLE)) {
      for (const locale of routing.locales) expect(disallow).toContain(`/${locale}${path}`);
    }
  });

  it('advertises the sitemap, absolutely', () => {
    const { sitemap: url } = withEnv(PRODUCTION, robots);
    expect(url).toMatch(/^https?:\/\/.+\/sitemap\.xml$/);
  });

  it('does not disallow the pages the sitemap offers', () => {
    // Guards against contradictory SEO directives between sitemap inclusions and robots disallows.
    const { rules } = withEnv(PRODUCTION, robots);
    const disallow = (Array.isArray(rules) ? [] : ((rules.disallow as string[]) ?? [])).map(String);
    const offered = withEnv(PRODUCTION, sitemap).map((e) => new URL(e.url).pathname);

    const contradicted = offered.filter((path) =>
      disallow.some((rule) => rule !== '/' && path.startsWith(rule)),
    );
    expect(contradicted).toEqual([]);
  });
});

describe('the structured data', () => {
  it('is valid JSON and names the organisation once', () => {
    const graph = siteJsonLd('fr')['@graph'];
    expect(JSON.parse(JSON.stringify(graph))).toEqual(graph);
    expect(graph.filter((node) => node['@type'] === 'Organization')).toHaveLength(1);
  });

  it('carries no placeholder anybody forgot to fill in', () => {
    /** Validates structured data against unresolved placeholders to prevent false machine-readable claims. */
    const serialised = JSON.stringify(siteJsonLd('fr'));
    expect(serialised).not.toMatch(/XXX|X{2,}\s*\/|TODO|à compléter|lorem/i);
  });

  it('links the site to the organisation by id rather than repeating it', () => {
    const graph = siteJsonLd('en')['@graph'];
    const organisation = graph.find((n) => n['@type'] === 'Organization') as { '@id': string };
    const site = graph.find((n) => n['@type'] === 'WebSite') as { publisher: { '@id': string } };

    // Enforces single-source-of-truth for entities by asserting identifier linkage over duplication.
    expect(site.publisher['@id']).toBe(organisation['@id']);
  });

  it('declares the language of the site it describes', () => {
    for (const locale of routing.locales) {
      const site = siteJsonLd(locale)['@graph'].find((n) => n['@type'] === 'WebSite') as {
        inLanguage: string;
      };
      expect(site.inLanguage).toBe(locale);
    }
  });
});
