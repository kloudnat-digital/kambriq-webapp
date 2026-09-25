import type { Metadata } from 'next';

import { routing, type Locale } from '@/i18n/routing';
import { withLocale } from '@/routes';

/**
 * The origin every absolute URL in the sitemap and robots file is built from.
 *
 * `NEXT_PUBLIC_APP_URL` is the same variable `metadataBase` reads in the root
 * layout, so a canonical tag and a sitemap entry cannot disagree about which
 * host this site is. The fallback is dev rather than production: a sitemap that
 * names the production host from a dev build would invite a crawler to index
 * URLs this deployment does not serve.
 */
export const siteUrl = (env: NodeJS.ProcessEnv = process.env): string =>
  (env.NEXT_PUBLIC_APP_URL || 'https://dev.kambriq.com').replace(/\/$/, '');

/** An absolute URL for an internal path under one locale. */
export const absoluteUrl = (path: string, locale: string, env?: NodeJS.ProcessEnv): string =>
  `${siteUrl(env)}${withLocale(path, locale)}`;

/**
 * The `hreflang` map for a page, including `x-default`.
 *
 * `x-default` names the page a crawler should serve when it cannot match a
 * language, and it points at the default locale rather than at the unprefixed
 * URL: the unprefixed URL is a 307 to one of these two, and a redirect is a
 * poor thing to nominate as the canonical answer.
 */
export const languageAlternates = (
  path: string,
  env?: NodeJS.ProcessEnv,
): Record<string, string> => {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) languages[locale] = absoluteUrl(path, locale, env);
  languages['x-default'] = absoluteUrl(path, routing.defaultLocale, env);
  return languages;
};

/**
 * `alternates` for a page's metadata: its canonical URL and its translations.
 *
 * Without a canonical, the same page under two locales competes with itself in
 * the index; without the alternates, the two language versions read as
 * unrelated pages and neither is offered to the right visitor. They are one
 * decision and are produced together for that reason.
 */
export const alternatesFor = (path: string, locale: Locale): Metadata['alternates'] => ({
  canonical: absoluteUrl(path, locale),
  languages: languageAlternates(path),
});
