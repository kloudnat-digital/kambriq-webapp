import { cookies, headers } from 'next/headers';

import { isLocale, routing, type Locale } from '@/i18n/routing';
import { localeOf } from '@/routes';

/**
 * next-intl's locale cookie. The name is its default and is not configured
 * away in `i18n/routing.ts`.
 */
const LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * The locale of the request, for code that runs outside the `[locale]`
 * segment.
 *
 * `getLocale()` resolves the locale from the rendered `[locale]` segment. A
 * Server Action is a POST handled outside that render, so nothing populates it
 * and `getLocale()` returns the default locale instead of failing - an English
 * visitor would be redirected into French with nothing reporting it.
 *
 * The `referer` is therefore read first: on a Server Action it is the page the
 * visitor submitted from, so its prefix is this request's locale exactly. The
 * cookie is the fallback for a request that carries no referer, and the
 * configured default is the last resort.
 *
 * Server Components must use `getLocale()` or their `params`. This function is
 * for the places that have neither.
 */
export const currentLocale = async (): Promise<Locale> => {
  const referer = (await headers()).get('referer');
  if (referer) {
    try {
      const fromReferer = localeOf(new URL(referer).pathname);
      if (isLocale(fromReferer)) return fromReferer;
    } catch {
      // A malformed referer is not worth failing a redirect over.
    }
  }

  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  return routing.defaultLocale;
};

/**
 * The language to render a request in, given its first path segment (P31).
 *
 * A known locale segment is the answer. Any other first segment - `/pricing`,
 * `/de/about` - is a 404, and the 404 page speaks the visitor's language: their
 * last explicit choice (the locale cookie), else the first supported language
 * in `Accept-Language`, else the default. The headers are read only on that
 * branch, so a page under a real locale is rendered as before.
 */
export const localeForSegment = async (segment: string | undefined): Promise<Locale> => {
  if (isLocale(segment)) return segment;

  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const accepted = ((await headers()).get('accept-language') ?? '')
    .split(',')
    .map((part) => part.split(';')[0].trim().slice(0, 2).toLowerCase());
  return accepted.find(isLocale) ?? routing.defaultLocale;
};
