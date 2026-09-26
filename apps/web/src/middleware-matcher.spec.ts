/**
 * @jest-environment node
 *
 * Next's matcher tester constructs a real `Request`, which jsdom does not
 * provide. This file asserts a routing table rather than any DOM, so it runs
 * under node.
 */

/**
 * `./auth` reaches for a NextAuth runtime and `next-intl/middleware` builds a
 * real locale negotiator. Neither is the subject here: this file is about the
 * exported `config` and the lists behind it.
 */
// `authForProxy`, not `auth`: A47 split the two NextAuth instances by who can
// write the session cookie, and the proxy uses the one that refreshes.
jest.mock('./auth', () => ({ authForProxy: (handler: unknown) => handler }));
jest.mock('next-intl/middleware', () => ({
  __esModule: true,
  default: () => () => undefined,
}));

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';

import { config } from './proxy';
import { routing } from './i18n/routing';
import { isProtected, isPublic, PROTECTED_PREFIXES, PUBLIC_PATHS, withLocale } from './routes';

/**
 * P3 - **every route the app serves, and whether the proxy still guards it.**
 *
 * Narrowing a matcher is the dangerous direction: the failure mode is a page
 * that used to require a session quietly becoming reachable by anyone, and
 * nothing about that is visible in a diff of a regex. So this file does not
 * assert a remembered list. It walks `src/app`, computes the URL of every
 * `page.tsx` and `route.ts` on disk, and checks each one against the matcher
 * that actually ships.
 *
 * ---------------------------------------------------------------------------
 * The matcher is compiled by Next, not modelled here
 * ---------------------------------------------------------------------------
 * This file used to carry its own `compile()` - a small regex translator for
 * the two matcher shapes the repo happened to use, which threw on anything
 * else. It was honest about its limits and it was still a second
 * implementation of somebody else's parser, and a wrong model reports a
 * protected route as covered.
 *
 * `unstable_doesMiddlewareMatch` is Next's own, from
 * `next/experimental/testing/server`, and it answers with the same code that
 * decides at runtime. It also removes the reason the old file needed a
 * guard-on-the-guard: there is no shape it cannot model, so `/(fr|en)/:path*`
 * needed no special case.
 */
const APP_DIR = join(__dirname, 'app');

/** Next's excluded infrastructure: not pages, and never intercepted. */
const NOT_PAGES = ['/api', '/health'];

/**
 * Files under `app` that are routing machinery rather than pages.
 *
 * `[...rest]` is the catch-all that routes an unmatched path under a valid
 * locale to `not-found.tsx`; it renders nothing and is reachable only by not
 * matching anything else, so it belongs to neither list below. Named rather
 * than pattern-matched away: a second catch-all appearing somewhere else is
 * something this file should fail on, not absorb.
 */
const NOT_A_PAGE = ['/[...rest]'];

/** The locale segment, which carries a language rather than a path. */
const LOCALE_SEGMENT = '[locale]';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

/**
 * `app/[locale]/(app)/admin/kbs/page.tsx` -> `/admin/kbs`.
 *
 * Route groups and the locale segment both drop out, for different reasons: a
 * group never appears in a URL at all, and the locale appears in every URL, so
 * neither distinguishes one route from another. Every list in `routes.ts` is
 * written in this unprefixed form.
 */
const urlOf = (file: string): string => {
  const rel = file.slice(APP_DIR.length).replace(/\\/g, '/');
  const withoutFile = rel.replace(/\/(page|route)\.tsx?$/, '');
  const segments = withoutFile
    .split('/')
    .filter((s) => s !== '' && s !== LOCALE_SEGMENT && !/^\(.*\)$/.test(s));
  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
};

const ROUTES = [
  ...new Set(
    walk(APP_DIR)
      .filter((f) => /\/(page|route)\.tsx?$/.test(f))
      .map(urlOf),
  ),
]
  .filter((r) => !NOT_PAGES.some((p) => r === p || r.startsWith(`${p}/`)))
  .filter((r) => !NOT_A_PAGE.includes(r))
  .sort();

const isMatched = (url: string) => unstable_doesMiddlewareMatch({ config, nextConfig: {}, url });

/** A concrete URL for a dynamic route, so the matcher sees a real path. */
const concrete = (route: string) => route.replace(/\[\.\.\.[^\]]+\]|\[[^\]]+\]/g, 'x');

/** Every locale-prefixed form of a path, which is how the app serves it. */
const inEveryLocale = (path: string) => routing.locales.map((locale) => withLocale(path, locale));

describe('the matcher covers every route the app serves', () => {
  it('is reading the routes it thinks it is', () => {
    // A walk that found nothing would make every assertion below vacuous, and
    // a walk that kept `[locale]` would find no route matching any list.
    expect(ROUTES.length).toBeGreaterThan(50);
    expect(ROUTES).toContain('/');
    expect(ROUTES).toContain('/contact');
    expect(ROUTES).toContain('/admin/payments');
    expect(ROUTES.filter((r) => r.includes(LOCALE_SEGMENT))).toEqual([]);
    // The exclusion above is real, not decorative: the file it names must exist.
    expect(existsSync(join(APP_DIR, LOCALE_SEGMENT, '(site)', '[...rest]', 'page.tsx'))).toBe(true);
  });

  it('the matcher tester discriminates, rather than answering yes to everything', () => {
    // The guard on the guard. A tester that matched everything would make the
    // coverage assertions below pass while proving nothing, and one that
    // matched nothing would fail them for the wrong reason.
    expect(isMatched('/fr/admin')).toBe(true);
    expect(isMatched('/de/admin')).toBe(false);
    expect(isMatched('/pricing')).toBe(false);
  });

  it('every route is either public or protected - nothing is neither', () => {
    /**
     * The partition is what replaced "not public means protected".
     *
     * The proxy asks `isProtected()` now, because the matcher has to see the
     * public paths to redirect them to a locale and negation under a wide
     * matcher sends every typo to a login page. The cost of asking positively
     * is that a new page in neither list is served to anybody, silently. This
     * is the assertion that stops that, and it names the route.
     */
    const unclassified = ROUTES.filter((r) => !isPublic(r) && !isProtected(r));
    expect(unclassified).toEqual([]);
  });

  it('every protected route is intercepted, in every locale', () => {
    const unguarded = ROUTES.filter(isProtected).flatMap((r) =>
      inEveryLocale(concrete(r)).filter((url) => !isMatched(url)),
    );
    expect(unguarded).toEqual([]);
  });

  it('the routes that must refuse an anonymous visitor are the ones we think', () => {
    // Named explicitly as well as swept, so the sweep going vacuous is visible.
    for (const route of [
      '/account',
      '/admin/payments',
      '/admin/kbs/candidates',
      '/agent/dashboard',
      '/kbs/enroll',
      '/kamnet/apply',
      '/lands',
      '/mylands/payment/x',
      '/profile',
      '/reservations/x',
      '/settings',
      '/welcome',
      '/invite',
      '/client/verify',
    ]) {
      expect(isPublic(route)).toBe(false);
      expect(isProtected(route)).toBe(true);
      for (const url of inEveryLocale(route)) expect(isMatched(url)).toBe(true);
    }
  });

  it('a public route is matched too, because it has to be sent to a locale', () => {
    // The change P3's original version would have read as a regression. Being
    // matched no longer means being guarded; `proxy.spec.ts` asserts the answer.
    for (const url of ['/about', '/fr/about', '/contact', '/fr/legal/privacy']) {
      expect(isMatched(url)).toBe(true);
    }
  });

  it('an unknown unprefixed URL is not intercepted, so Next can 404 it', () => {
    // Each of these answered 307 -> /login?callbackUrl=... before P3.
    for (const path of [
      '/zzz-does-not-exist',
      '/pricing',
      '/tarifs',
      '/robots.txt',
      '/sitemap.xml',
    ]) {
      expect(isMatched(path)).toBe(false);
    }
  });

  /**
   * A47. Every public page runs through the proxy, so a refresh it needs is
   * written back to the browser.
   *
   * The root layout reads the session on every page and only the proxy can
   * write a refreshed session cookie - NextAuth appends the session's
   * `set-cookie` onto whatever response the handler returns. A public page the
   * proxy never matched refreshed where nothing could save the result, and
   * browsing two of them signed the person out.
   *
   * Running is not gating: `proxy.spec.ts` walks the same pages through the
   * real decision and finds every one of them ungated. Pinning the two together
   * is the conflation P3 was about.
   */
  it('every public page runs through the proxy, in both locales', () => {
    const publicPages = ROUTES.filter(isPublic);
    expect(publicPages.length).toBeGreaterThan(20);

    const unseen = publicPages.flatMap((r) =>
      inEveryLocale(concrete(r)).filter((url) => !isMatched(url)),
    );
    expect(unseen).toEqual([]);
  });

  /**
   * A47 listed each public page in the matcher one at a time, never as a
   * prefix, so that an unknown URL stayed unmatched and still answered 404.
   * Locale routing uses prefixes and `/(fr|en)/:path*` instead, so that
   * assertion is deliberately not carried over - it pinned an implementation,
   * and the property it protected is asserted directly by
   * "an unknown unprefixed URL is not intercepted" above and by the positive
   * `isProtected()` gate that proxy.spec.ts runs.
   */
  it('a locale that is not configured is not a locale', () => {
    // `/de/admin` must not reach the matcher's locale branch, or a third
    // language could be invented by typing it.
    for (const url of ['/de/admin', '/es/mylands', '/england']) {
      expect(isMatched(url)).toBe(false);
    }
  });

  it('the matcher literals and the route lists say the same thing', () => {
    /**
     * Next requires the matcher to be statically analysable, so it cannot be
     * built from the lists at module scope. Two lists that must agree are two
     * lists that drift, so this is the thing that stops them.
     */
    const LOCALE_ENTRIES = ['/', '/(fr|en)', '/(fr|en)/:path*'];
    const fromMatcher = [
      ...new Set(
        (config.matcher as string[])
          .filter((m) => !LOCALE_ENTRIES.includes(m))
          .map((m) => m.split('/:')[0]),
      ),
    ].sort();

    const fromLists = [...new Set([...PUBLIC_PATHS, ...PROTECTED_PREFIXES])]
      .filter((p) => p !== '/')
      .sort();

    expect(fromMatcher).toEqual(fromLists);
  });

  it('the three locale entries are present and are the only patterns', () => {
    for (const entry of ['/', '/(fr|en)', '/(fr|en)/:path*']) {
      expect(config.matcher).toContain(entry);
    }
    // Any other parenthesised entry would be a second pattern nobody declared.
    const patterns = (config.matcher as string[]).filter((m) => m.includes('('));
    expect(patterns.sort()).toEqual(['/(fr|en)', '/(fr|en)/:path*']);
  });

  it('every listed prefix is present in both forms, bare and with children', () => {
    // `/admin` without `/admin/:path*` would guard the index and leave every
    // page under it open - the exact shape of a narrowing that goes wrong.
    for (const prefix of [...PUBLIC_PATHS, ...PROTECTED_PREFIXES].filter((p) => p !== '/')) {
      expect(config.matcher).toContain(prefix);
      expect(config.matcher).toContain(`${prefix}/:path*`);
      expect(isMatched(prefix)).toBe(true);
      expect(isMatched(`${prefix}/deeper/still`)).toBe(true);
    }
  });

  it('the matcher contains no catch-all negative pattern', () => {
    // What was there before P3: '/((?!api|health|_next/static|...).*)'. It is
    // also what next-intl's own documentation recommends for this file, so the
    // ban is against a shape somebody will be told to use, not a forgotten one.
    for (const pattern of config.matcher as string[]) {
      expect(pattern).not.toContain('(?!');
    }
  });
});

/**
 * The table the brief asks for, printed from the code rather than typed.
 *
 * It runs as a test so it cannot rot: if the walk stops finding routes, the
 * assertion above it fails rather than the table quietly shrinking.
 */
describe('the route table', () => {
  it('enumerates every route and how an anonymous visitor is answered', () => {
    const rows = ROUTES.map((route) => {
      const url = withLocale(concrete(route), routing.defaultLocale);
      return {
        route,
        public: isPublic(route),
        protected: isProtected(route),
        matched: isMatched(url),
      };
    });

    expect(rows.filter((r) => r.protected && !r.matched)).toEqual([]);

    console.log(
      `\nROUTE TABLE (${rows.length} routes, ${routing.locales.join('/')})\n` +
        `${'route'.padEnd(40)} public  protected  matched  anonymous-visitor\n` +
        rows
          .map(
            (r) =>
              `${r.route.padEnd(40)} ${String(r.public).padEnd(7)} ${String(r.protected).padEnd(10)} ` +
              `${String(r.matched).padEnd(8)} ${r.protected ? 'REFUSED' : 'served'}`,
          )
          .join('\n'),
    );
  });
});
