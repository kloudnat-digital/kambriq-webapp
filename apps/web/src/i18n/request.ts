import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';

/**
 * Resolves the locale for a request from the `[locale]` route segment.
 *
 * This read the `NEXT_LOCALE` cookie until locale-prefixed routing landed. A
 * cookie makes one URL serve two languages, so a crawler - which sends no
 * cookie - could only ever see the default one.
 *
 * `requestLocale` is `undefined` or invalid when something outside the
 * `[locale]` segment renders, and it is invalid for any unknown first segment,
 * because `[locale]` matches one. Falling back to the default locale in that
 * case would render the French home page at `/pricing` with HTTP 200, which is
 * a soft 404: indexable, and invisible to any monitor.
 *
 * The refusal is `dynamicParams = false` on the `[locale]` layout, which
 * returns 404 for a segment value `generateStaticParams` did not produce. This
 * function only has to avoid inventing a locale when it was handed a value the
 * routing configuration does not know.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
