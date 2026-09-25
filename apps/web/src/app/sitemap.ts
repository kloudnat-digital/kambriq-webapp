import type { MetadataRoute } from 'next';

import { routing } from '@/i18n/routing';
import { INDEXABLE_PAGES, PAGE_WEIGHT } from '@/lib/seo/pages';
import { absoluteUrl, languageAlternates } from '@/lib/seo/urls';
import { isIndexableEnvironment } from '@/lib/seo/robots';

/**
 * `/sitemap.xml`, which this site did not have.
 *
 * One entry per page per locale, each carrying the `hreflang` alternates of its
 * counterparts. Listing only the default locale would leave the English site
 * discoverable by nothing: it is a distinct URL, and before locale-prefixed
 * routing it was not even addressable.
 *
 * Nothing under `[locale]` is walked to produce this. A sitemap is a claim
 * about what the site offers a stranger, so it is built from a declared list -
 * see `lib/seo/pages.ts`, where the exclusions carry their reasons and a spec
 * pins both directions.
 *
 * On an environment that may not be indexed it returns nothing rather than a
 * list. A sitemap that names a dev host is an invitation, and `robots.txt`
 * already refuses everything there - two mechanisms saying the same thing, on
 * purpose, because the cost of them disagreeing falls entirely on the side of
 * being indexed by accident.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!isIndexableEnvironment()) return [];

  const lastModified = new Date();

  return INDEXABLE_PAGES.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: absoluteUrl(path, locale),
      lastModified,
      changeFrequency: PAGE_WEIGHT[path]?.changeFrequency ?? 'monthly',
      priority: PAGE_WEIGHT[path]?.priority ?? 0.5,
      alternates: { languages: languageAlternates(path) },
    })),
  );
}
