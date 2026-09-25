import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { routing } from '@/i18n/routing';
import { PROTECTED_PREFIXES, PUBLIC_PATHS } from '@/routes';
import { INDEXABLE_PAGES, NOT_INDEXABLE, PAGE_WEIGHT } from './pages';
import { siteJsonLd } from './json-ld';

/**
 * The sitemap and robots.txt this site did not have, and what they must not say.
 *
 * Both are read by machines, once, and acted on for weeks. A wrong entry does
 * not throw and nobody reads the output: the only signals are a page missing
 * from an index somebody has to think to check, or a page appearing in one that
 * should never have been offered.
 *
 * The environment decides everything here, and it is read from `APP_ENV` alone.
 * `NODE_ENV` is `production` on dev too - the runtime image sets it - so a
 * check against it would put a live sitemap on dev.kambriq.com while every
 * local test agreed it worked.
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
    /**
     * An empty sitemap rather than a dev one.
     *
     * A sitemap naming dev.kambriq.com is an invitation to index the staging
     * site under the brand name - invisible until somebody searches for it, and
     * weeks to unpick.
     */
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
    // Without these the two language versions read as unrelated pages and
    // neither is offered to the right visitor - which is the whole reason the
    // URLs carry a locale.
    for (const entry of withEnv(PRODUCTION, sitemap)) {
      const languages = entry.alternates?.languages ?? {};
      expect(Object.keys(languages).sort()).toEqual(['en', 'fr', 'x-default']);
    }
  });

  it('offers no page that requires a session', () => {
    // THE OUTCOME. A sitemap entry pointing at a login wall spends the crawl
    // budget and fills Search Console with soft 404s.
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
    // An unset priority is read as 0.5, which would rank the legal pages level
    // with the home page. Defaulting silently is the failure here.
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
    /**
     * Pinned in both directions, so the list cannot rot into a lie.
     *
     * A public page nobody adds here is invisible to search, and nothing
     * reports it - which is how a site ends up with pages that exist and
     * cannot be found.
     */
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
    // An exclusion for a page that has gone is an exclusion that hides the
    // next one.
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
    // The two files contradicting each other is the failure nobody would see:
    // the sitemap says "index this", robots says "do not fetch it", and the
    // page simply never appears.
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
    /**
     * The public mentions légales still serves `Capital social : XXX XXX XAF`
     * and `N° RCCM : XX / XXX / XX`. Structured data is a machine-readable
     * claim about a real legal entity, and a placeholder published as one is a
     * false statement that a search engine will repeat.
     */
    const serialised = JSON.stringify(siteJsonLd('fr'));
    expect(serialised).not.toMatch(/XXX|X{2,}\s*\/|TODO|à compléter|lorem/i);
  });

  it('links the site to the organisation by id rather than repeating it', () => {
    const graph = siteJsonLd('en')['@graph'];
    const organisation = graph.find((n) => n['@type'] === 'Organization') as { '@id': string };
    const site = graph.find((n) => n['@type'] === 'WebSite') as { publisher: { '@id': string } };

    // Two copies of one entity is how a name and an address come to disagree.
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
