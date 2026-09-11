/**
 * `next/server` needs web globals jsdom does not provide, and `./auth` reaches
 * for a NextAuth runtime. Both are stubbed exactly as `proxy.spec.ts` stubs
 * them: this file is about the exported `config`, not about Next internals.
 */
jest.mock('next/server', () => ({
  NextResponse: { next: () => ({ kind: 'next' }), redirect: () => ({ kind: 'redirect' }) },
}));
jest.mock('./auth', () => ({ auth: (handler: unknown) => handler }));

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { config } from './proxy';
import { isPublic, PROTECTED_PREFIXES, REDIRECT_WHEN_AUTHED } from './routes';

/**
 * P3 - **every route the app serves, and whether the middleware still guards
 * it.**
 *
 * Narrowing a matcher is the dangerous direction: the failure mode is a page
 * that used to require a session quietly becoming reachable by anyone, and
 * nothing about that is visible in a diff of a regex. So this file does not
 * assert a remembered list. It walks `src/app`, computes the URL of every
 * `page.tsx` and `route.ts` on disk, and checks each one against the matcher
 * that actually ships.
 *
 * The rule it enforces is one sentence: **a route that `isPublic()` refuses
 * must be matched by the middleware.** If it is not, an anonymous request
 * reaches it, and the suite says which route by name.
 */
const APP_DIR = join(__dirname, 'app');

/** Next's excluded infrastructure: not pages, and never intercepted. */
const NOT_PAGES = ['/api', '/health'];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

/** `app/(app)/admin/kbs/page.tsx` -> `/admin/kbs`. Route groups drop out. */
const urlOf = (file: string): string => {
  const rel = file.slice(APP_DIR.length).replace(/\\/g, '/');
  const withoutFile = rel.replace(/\/(page|route)\.tsx?$/, '');
  const segments = withoutFile.split('/').filter((s) => s !== '' && !/^\(.*\)$/.test(s));
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
  .sort();

/**
 * Compiles one Next matcher entry into a regular expression.
 *
 * Only the two shapes this repo's matcher uses are supported - a literal path
 * and a trailing `/:path*` - and anything else **throws** rather than being
 * quietly treated as a literal. A matcher compiler that silently mis-reads a
 * pattern it does not understand would report a protected route as covered.
 *
 * `:path*` is zero-or-more segments, so `/admin/:path*` matches `/admin` too.
 * The shipped matcher lists both forms anyway; this models Next's behaviour
 * rather than relying on it.
 */
const compile = (pattern: string): RegExp | null => {
  if (/:[A-Za-z]+\*$/.test(pattern)) {
    const base = pattern.replace(/\/:[A-Za-z]+\*$/, '');
    return new RegExp(`^${base}(?:/.*)?$`);
  }
  if (pattern.includes(':') || pattern.includes('(')) return null;
  return new RegExp(`^${pattern}$`);
};

const PATTERNS = config.matcher as string[];

/**
 * Patterns this file cannot model, named rather than guessed at.
 *
 * `compile` returns `null` instead of throwing, and the throw used to be at
 * module scope. Restoring the old catch-all matcher as a mutation therefore
 * **crashed the suite before a single test ran** - `Tests: 0 total` - which is
 * the repository's own rule that if a mutation makes the suite fail to build,
 * the mutation has not been run yet. A crash is not a failing assertion: it
 * reports that this file is broken, not that the matcher is wrong.
 *
 * Now an unmodellable pattern fails one named test with a readable message,
 * and every other assertion still executes and reports on its own.
 */
const UNMODELLABLE = PATTERNS.filter((p) => compile(p) === null);

const MATCHERS = PATTERNS.map(compile).filter((re): re is RegExp => re !== null);
const isMatched = (pathname: string) => MATCHERS.some((re) => re.test(pathname));

/** A concrete URL for a dynamic route, so the matcher sees a real path. */
const concrete = (route: string) => route.replace(/\[\.\.\.[^\]]+\]|\[[^\]]+\]/g, 'x');

describe('P3 - the middleware matcher covers every protected route', () => {
  it('every matcher pattern is one this file can model', () => {
    /**
     * The guard on the guard. A pattern this file cannot model is excluded from
     * `MATCHERS`, which would make every "is it matched" assertion below answer
     * from an incomplete picture - a protected route could read as covered by
     * a pattern that was silently dropped.
     *
     * This is also the test that catches the old catch-all coming back: a
     * negative lookahead is not a shape this models, on purpose.
     */
    expect(UNMODELLABLE).toEqual([]);
  });

  it('is reading the routes it thinks it is', () => {
    // A walk that found nothing would make every assertion below vacuous.
    expect(ROUTES.length).toBeGreaterThan(50);
    expect(ROUTES).toContain('/');
    expect(ROUTES).toContain('/contact');
    expect(ROUTES).toContain('/admin/payments');
  });

  it('every protected route is still intercepted', () => {
    const unguarded = ROUTES.filter((r) => !isPublic(r)).filter((r) => !isMatched(concrete(r)));
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
      expect(isMatched(route)).toBe(true);
    }
  });

  it('unknown public URLs are NOT intercepted, so Next can 404 them', () => {
    // The audit's finding, as a property. Each of these answered
    // 307 -> /login?callbackUrl=... before this chantier.
    for (const path of [
      '/zzz-does-not-exist',
      '/pricing',
      '/tarifs',
      '/robots.txt',
      '/sitemap.xml',
      '/blog/a-post-that-moved',
      '/legal/does-not-exist',
    ]) {
      expect(isMatched(path)).toBe(false);
    }
  });

  it('public pages are not intercepted, except the three that redirect a signed-in user', () => {
    const intercepted = ROUTES.filter((r) => isPublic(r)).filter((r) => isMatched(concrete(r)));
    expect(intercepted.sort()).toEqual([...REDIRECT_WHEN_AUTHED].sort());
  });

  it('the matcher literals and PROTECTED_PREFIXES say the same thing', () => {
    /**
     * Next requires the matcher to be statically analysable, so it cannot be
     * built from `PROTECTED_PREFIXES`. Two lists that must agree are two lists
     * that drift, so this is the thing that stops them.
     */
    const fromMatcher = [...new Set((config.matcher as string[]).map((m) => m.split('/:')[0]))]
      .filter((p) => !REDIRECT_WHEN_AUTHED.includes(p))
      .sort();
    expect(fromMatcher).toEqual([...PROTECTED_PREFIXES].sort());
  });

  it('every protected prefix is listed in both forms, bare and with children', () => {
    // `/admin` without `/admin/:path*` would guard the index and leave every
    // page under it open - the exact shape of a narrowing that goes wrong.
    for (const prefix of PROTECTED_PREFIXES) {
      expect(config.matcher).toContain(prefix);
      expect(config.matcher).toContain(`${prefix}/:path*`);
      expect(isMatched(prefix)).toBe(true);
      expect(isMatched(`${prefix}/deeper/still`)).toBe(true);
    }
  });

  it('the matcher no longer contains a catch-all negative pattern', () => {
    // What was there before: '/((?!api|health|_next/static|...).*)'. It is the
    // shape that caused this chantier, not just the specific string.
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
describe('P3 - the route table', () => {
  it('enumerates every route and whether it is protected after the change', () => {
    const rows = ROUTES.map((route) => {
      const path = concrete(route);
      return {
        route,
        public: isPublic(route),
        matched: isMatched(path),
        protectedAfter: !isPublic(route) && isMatched(path),
      };
    });

    const widened = rows.filter((r) => !r.public && !r.matched);
    expect(widened).toEqual([]);

    console.log(
      `\nROUTE TABLE (${rows.length} routes)\n` +
        `${'route'.padEnd(40)} public  matched  anonymous-visitor\n` +
        rows
          .map(
            (r) =>
              `${r.route.padEnd(40)} ${String(r.public).padEnd(7)} ${String(r.matched).padEnd(8)} ` +
              `${r.protectedAfter ? 'REFUSED' : r.public ? 'served' : 'served (!)'}`,
          )
          .join('\n'),
    );
  });
});
