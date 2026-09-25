import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';
import { alternatesFor } from './urls';

/**
 * Metadata for a public page: its title, its description, and where it says it
 * lives.
 *
 * Every public page already returned a title and a description. None returned
 * `alternates`, so each language version competed with the other in the index
 * and neither pointed at its translation - which is the whole reason the URLs
 * carry a locale now. Adding it page by page would have left the next page
 * without it, so the three are produced together, from the page's own path.
 *
 * The path is passed rather than derived: a Server Component cannot read its
 * own pathname, and inferring one from the file location would be a second
 * route table.
 */
export const publicPageMetadata = async (
  path: string,
  namespace: string,
  overrides: Metadata = {},
): Promise<Metadata> => {
  const [locale, t] = await Promise.all([getLocale(), getTranslations(namespace)]);

  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesFor(path, locale as Locale),
    ...overrides,
  };
};

/**
 * Metadata for a page that is public but must not be indexed.
 *
 * Login and the token pages are reachable without a session and answer no
 * search: a form is not content, and `/reset-password` means nothing without
 * the single-use token in its query. They carry a title so the browser tab and
 * a bookmark read correctly, and `robots: noindex` so the page is not offered
 * to somebody who was looking for something else.
 *
 * `robots.txt` disallows them too. Two mechanisms on purpose: a `Disallow` asks
 * a crawler not to fetch the page, and a page fetched from a link elsewhere can
 * still be indexed on the strength of that link. Only the meta directive
 * refuses the indexing itself.
 */
export const unindexedPageMetadata = (title: string): Metadata => ({
  title,
  robots: { index: false, follow: true },
});
