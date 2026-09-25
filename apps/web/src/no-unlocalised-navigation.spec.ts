import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Navigation goes through `@/i18n/navigation`, or it loses the locale.
 *
 * `next/link` and `next/navigation` know nothing about the locale prefix, so
 * `<Link href="/about">` renders `/about` - a URL that no longer resolves to a
 * page, because every page lives under `[locale]`. `useRouter().push` and
 * `redirect` do the same. Nothing about that is loud: the link renders, the
 * anchor looks right in the markup, and the visitor gets a 404 on click.
 *
 * ---------------------------------------------------------------------------
 * The outcome is banned before the mechanisms are
 * ---------------------------------------------------------------------------
 * This repository has an entry about a test that banned every alternative money
 * formatter and stayed green over "750 000 FCFA XAF", because the defect was
 * typed rather than called. So the first assertion here is about the thing that
 * actually goes wrong - an `href` written with a locale already in it, which is
 * what somebody reaches for when a link lands in the wrong language - and the
 * import bans follow it.
 *
 * ---------------------------------------------------------------------------
 * Matched by position, not by substring
 * ---------------------------------------------------------------------------
 * A doc comment that names `next/link` in order to explain why it is banned is
 * the first thing a substring sweep flags, and this file is itself full of such
 * mentions. An import declaration opens its own line, so the expressions are
 * anchored with `^[ \t]*import` under `m`. Proved by this file passing: every
 * banned specifier appears in the prose above.
 */
const SRC = join(__dirname);

/**
 * Files allowed to provide navigation of their own, each with the reason and a
 * check that the reason still holds.
 *
 * An exemption for a file that has stopped doing the thing it was exempted for
 * is an exemption that means nothing, and it is where the next real offender
 * hides.
 */
const EXEMPT: Record<string, { reason: string; stillTrue: (source: string) => boolean }> = {
  'i18n/navigation.ts': {
    reason: 'builds the localised wrappers from next-intl',
    stillTrue: (s) => /from\s+['"]next-intl\/navigation['"]/.test(s),
  },
  'test-utils/navigation-mock.tsx': {
    reason: 'stands in for the wrappers in component tests',
    stillTrue: (s) => /export const Link\b/.test(s),
  },
};

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });

const FILES = walk(SRC)
  .map((f) => ({ path: f, rel: relative(SRC, f).replace(/\\/g, '/') }))
  .filter(({ rel }) => !(rel in EXEMPT));

/** The files that ship to a browser: everything except the specs. */
const SHIPPED = FILES.filter(({ rel }) => !/\.spec\.tsx?$/.test(rel));

const read = (path: string) => readFileSync(path, 'utf8');

/** An `import ... from 'next/link'` declaration, never a mention of one. */
const IMPORTS_NEXT_LINK = /^[ \t]*import[^;]*from\s+['"]next\/link['"]/m;

/** An `import { ... } from 'next/navigation'` declaration and its specifiers. */
const IMPORTS_NEXT_NAVIGATION = /^[ \t]*import\s*\{([^}]*)\}\s*from\s+['"]next\/navigation['"]/gm;

/**
 * The `next/navigation` exports that are locale-aware and must be wrapped.
 *
 * `notFound`, `useSearchParams` and `useParams` are not: they carry no
 * pathname, so the locale cannot be lost through them, and routing them
 * through the wrapper would be noise.
 */
const MUST_BE_LOCALISED = ['useRouter', 'usePathname', 'redirect', 'permanentRedirect'];

/** A locale written into an href by hand, which the wrapper would double. */
const HARDCODED_LOCALE_HREF = /\b(?:href|pathname)\s*[:=]\s*["'`]\/(?:fr|en)(?:\/|["'`])/;

describe('every navigation carries its locale', () => {
  it('is reading the files it thinks it is', () => {
    // A walk that found nothing would make every assertion below vacuous.
    expect(FILES.length).toBeGreaterThan(200);
    expect(SHIPPED.length).toBeGreaterThan(200);
    expect(FILES.some(({ rel }) => rel === 'routes.ts')).toBe(true);
    expect(FILES.some(({ rel }) => rel.startsWith('app/[locale]/'))).toBe(true);
    // The specs are excluded from the href sweep, so their absence has to be
    // visible here rather than being assumed.
    expect(FILES.length - SHIPPED.length).toBeGreaterThan(10);
  });

  it('the exemptions still exist and still need exempting', () => {
    const stale = Object.entries(EXEMPT)
      .filter(([rel, { stillTrue }]) => !stillTrue(read(join(SRC, rel))))
      .map(([rel, { reason }]) => `${rel} (exempt because it ${reason})`);
    expect(stale).toEqual([]);
  });

  it('no href hardcodes a locale', () => {
    /**
     * THE OUTCOME. A literal locale in an href renders `/fr/fr/about` for a
     * French visitor and pins an English one to French. It is what somebody
     * writes when a link came out in the wrong language, and no import ban
     * would see it.
     *
     * Scoped to shipped source. A spec names locale-prefixed URLs on purpose -
     * that is how it asserts the prefix arrived - and so does the prose in this
     * very file, which the first version of this sweep flagged as an offender.
     * That is the repository's own lesson about a sweep counting its own
     * explanation, and it fired here within a minute of the rule existing.
     */
    const offenders = SHIPPED.filter(({ path }) => HARDCODED_LOCALE_HREF.test(read(path))).map(
      ({ rel }) => rel,
    );
    expect(offenders).toEqual([]);
  });

  it('nothing imports next/link', () => {
    const offenders = FILES.filter(({ path }) => IMPORTS_NEXT_LINK.test(read(path))).map(
      ({ rel }) => rel,
    );
    expect(offenders).toEqual([]);
  });

  it('nothing imports a locale-aware export from next/navigation', () => {
    const offenders: string[] = [];
    for (const { path, rel } of FILES) {
      for (const match of read(path).matchAll(IMPORTS_NEXT_NAVIGATION)) {
        const specifiers = match[1].split(',').map((s) =>
          s
            .trim()
            .split(/\s+as\s+/)[0]
            .trim(),
        );
        const banned = specifiers.filter((s) => MUST_BE_LOCALISED.includes(s));
        if (banned.length) offenders.push(`${rel}: ${banned.join(', ')}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('still allows the exports that carry no pathname', () => {
    // The ban has to let `notFound` and `useSearchParams` through, or it stops
    // being a rule about locales and becomes a rule about one module.
    const stillUsed = FILES.filter(({ path }) =>
      /^[ \t]*import\s*\{[^}]*\bnotFound\b[^}]*\}\s*from\s+['"]next\/navigation['"]/m.test(
        read(path),
      ),
    );
    expect(stillUsed.length).toBeGreaterThan(0);
  });
});
