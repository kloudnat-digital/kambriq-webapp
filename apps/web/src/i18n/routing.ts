import { defineRouting } from 'next-intl/routing';

/**
 * The locale routing configuration, and the single definition of the supported
 * locales.
 *
 * `localePrefix: 'always'` puts the locale in every URL (`/fr/about`,
 * `/en/about`). It is stated rather than left to the default because the whole
 * point of the setting is that one URL serves one language: a cookie-driven
 * locale makes the English site unreachable to a crawler, which sends no
 * cookie, and leaves `hreflang` with no URLs to point at.
 *
 * `localeCookie` keeps next-intl's default name, `NEXT_LOCALE`, which is the
 * cookie this app used to set by hand. The cookie is now a record of the
 * visitor's last choice, read only to decide where `/` sends them; the URL is
 * what determines the language of a page.
 */
export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'always',
});

/**
 * The locale type, derived from the configuration rather than spelled again.
 *
 * `'fr' | 'en'` was written out at six call sites. A literal union cannot fail
 * when a locale is added; this alias does.
 */
export type Locale = (typeof routing.locales)[number];

/** Narrows an unknown value to a supported locale. */
export const isLocale = (value: unknown): value is Locale =>
  routing.locales.includes(value as Locale);
