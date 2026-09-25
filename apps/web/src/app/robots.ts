import type { MetadataRoute } from 'next';

import { PROTECTED_PREFIXES } from '@/routes';
import { routing } from '@/i18n/routing';
import { NOT_INDEXABLE } from '@/lib/seo/pages';
import { isIndexableEnvironment } from '@/lib/seo/robots';
import { siteUrl } from '@/lib/seo/urls';

/**
 * `/robots.txt`, which this site did not have.
 *
 * `lib/seo/robots.ts` sends an `X-Robots-Tag` header on every response, and
 * that header is the one that actually stops a page being indexed. This file is
 * the other half: a crawler reads `robots.txt` before it requests anything, so
 * it is what stops the request being made at all, and it is the only place a
 * sitemap can be advertised to a crawler that was not told where to look.
 *
 * Both read `isIndexableEnvironment`, so there is one decision rather than two
 * that can drift. `NODE_ENV` cannot make it: the runtime image sets
 * `NODE_ENV=production` on dev as well, so dev.kambriq.com reports itself as
 * production. `APP_ENV` exists for this, and an absent value means noindex -
 * the two failures are not symmetrical. A production site that forgot to
 * declare itself is visible in Search Console within a day and fixed by one
 * variable; a dev site that forgot is indexed under the brand name, invisible
 * until somebody searches for it, and weeks to unpick.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexableEnvironment()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  /**
   * Every protected prefix, in both locales and unprefixed.
   *
   * A crawler that requests `/fr/mylands` is answered with a redirect to a
   * login page, so nothing leaks - but it spends this site's crawl budget on
   * pages no visitor can read, and it fills Search Console with soft 404s.
   * The unprefixed form is listed too, because that is the URL an old link
   * carries and the redirect to a locale happens before anything else.
   */
  const protectedPaths = PROTECTED_PREFIXES.flatMap((prefix) => [
    `${prefix}/`,
    ...routing.locales.map((locale) => `/${locale}${prefix}/`),
  ]);

  /** Public pages that answer no search - forms, and single-use token URLs. */
  const uselessToIndex = Object.keys(NOT_INDEXABLE).flatMap((path) =>
    routing.locales.map((locale) => `/${locale}${path}`),
  );

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...protectedPaths, ...uselessToIndex, '/api/'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
