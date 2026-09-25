import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/**
 * The navigation APIs, which are the only ones that know about the locale
 * prefix.
 *
 * Each wraps its `next/navigation` or `next/link` equivalent and rewrites the
 * pathname for the active locale, so `<Link href="/about">` renders
 * `/fr/about` for a visitor on `/fr`. The unwrapped originals produce a URL
 * with no prefix, which resolves to the wrong language or to nothing at all -
 * `no-unlocalised-navigation.spec.ts` is what stops them coming back.
 *
 * Two differences from the originals are worth knowing at the call site:
 *
 * - `usePathname` returns the pathname WITHOUT the locale prefix, so a visitor
 *   on `/fr/about` reads `/about`. Comparisons against route constants
 *   therefore work unchanged.
 * - `redirect` requires an explicit `locale`, because a Server Component
 *   cannot infer one from a hook. `getLocale()` supplies it.
 */
const navigation = createNavigation(routing);

export const { Link, usePathname, useRouter, getPathname } = navigation;

/**
 * Re-exported with an explicit annotation so that `never` survives.
 *
 * `redirect` is declared as returning `never`, and it does - it delegates to
 * `next/navigation`'s `redirect`, which throws. TypeScript narrows control
 * flow through a `never`-returning call only when the callee's declaration
 * carries an explicit type annotation, and a binding destructured from a
 * function call is inferred. Without this line, `if (!x) redirect(...)` stops
 * narrowing `x`, and the compiler reports the null it can no longer rule out
 * at every call site rather than at the import.
 */
export const redirect: typeof navigation.redirect = navigation.redirect;
