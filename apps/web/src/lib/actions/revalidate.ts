import { revalidatePath } from 'next/cache';

import { currentLocale } from '@/lib/locale';
import { withLocale } from '@/routes';

/**
 * Invalidates the cache for a path the client supplied, in the locale the
 * request came from.
 *
 * Client components read their path from next-intl's `usePathname`, which
 * returns it WITHOUT the locale prefix - `/account`, never `/fr/account`.
 * `revalidatePath` matches on the route file structure rather than on what the
 * caller meant, so an unprefixed path silently matches nothing now that every
 * page lives under `[locale]`. Nothing would report it: the mutation still
 * succeeds and the screen simply keeps showing the old value.
 *
 * The locale is taken from the request rather than from the caller, because a
 * Server Action carries no `[locale]` segment. See `lib/locale.ts`.
 *
 * Only the current locale is invalidated. The alternative, the route pattern
 * `/[locale]<path>` with `'page'`, would cover both at once, but whether it
 * has to spell the `(app)` route group as well is not something the Next
 * documentation settles - and every path routed through here belongs to an
 * authenticated, dynamically rendered page, where the other locale's copy is
 * not being served from cache to anybody.
 */
export const revalidateLocalisedPath = async (pathname: string): Promise<void> => {
  revalidatePath(withLocale(pathname, await currentLocale()));
};
