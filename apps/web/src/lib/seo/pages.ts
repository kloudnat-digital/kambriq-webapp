/**
 * The public pages a search engine should know about, and the ones it must not.
 *
 * The sitemap is a claim about what this site offers, so it is a declared list
 * rather than a walk of the route files: every page under `[locale]` would
 * include the authenticated application, and a sitemap that lists `/mylands` is
 * an invitation to crawl a login wall.
 *
 * `sitemap-covers-the-public-site.spec.ts` pins it in both directions - every
 * entry resolves to a page, and every public page is either listed here or
 * excluded below with a reason - so the list cannot silently fall behind the
 * routes.
 */
export const INDEXABLE_PAGES = [
  '/',
  '/about',
  '/contact',
  '/faq',
  '/blog',
  '/methode',
  '/plan',
  '/products/lands',
  '/products/verify',
  '/products/kbs',
  '/products/kamnet',
  /**
   * P11's directory, arriving with the develop merge of 25 September.
   *
   * Indexed deliberately. It is the public face of KAMNET and the thing a buyer
   * checks an agent against, and every agent on it consented explicitly -
   * `publicListingConsentAt`, a timestamp rather than a boolean, withdrawn by
   * writing null. There is no per-agent URL, so indexing this page creates one
   * search result about the directory rather than a permanent page per person.
   */
  '/products/kamnet/annuaire',
  '/legal/privacy',
  '/legal/terms',
  '/legal/mentions',
  '/legal/rgpd',
] as const;

/**
 * Public pages deliberately kept out of the sitemap, each with its reason.
 *
 * Being public is not the same as being worth indexing. A login form in the
 * index answers no query anybody has, and the token pages are worse than
 * useless: the URL is only meaningful with a single-use token attached.
 */
export const NOT_INDEXABLE: Record<string, string> = {
  '/login': 'a form, not content; answers no search',
  '/register': 'a form, not content; answers no search',
  '/forgot-password': 'a form, not content; answers no search',
  '/reset-password': 'meaningless without the single-use token in its query',
  '/verify-email': 'meaningless without the single-use token in its query',
  '/reactivate': 'reached only from a redirect, and only inside a grace period',
  '/verify-certificate': 'a lookup keyed on a certificate number, not a page',
};

/**
 * How often each page is worth re-crawling, and how it ranks against the rest.
 *
 * Both are hints rather than instructions, and both are stated rather than
 * defaulted: an unset priority is read as 0.5 by Google, so leaving it out
 * would rank the legal pages level with the home page.
 */
export const PAGE_WEIGHT: Record<
  string,
  { changeFrequency: 'weekly' | 'monthly' | 'yearly'; priority: number }
> = {
  '/': { changeFrequency: 'weekly', priority: 1 },
  '/blog': { changeFrequency: 'weekly', priority: 0.8 },
  '/products/lands': { changeFrequency: 'weekly', priority: 0.9 },
  '/products/verify': { changeFrequency: 'monthly', priority: 0.9 },
  '/products/kbs': { changeFrequency: 'monthly', priority: 0.9 },
  '/products/kamnet': { changeFrequency: 'monthly', priority: 0.9 },
  // Weekly: the roll changes when an agent is certified, consents or withdraws.
  '/products/kamnet/annuaire': { changeFrequency: 'weekly', priority: 0.7 },
  '/methode': { changeFrequency: 'monthly', priority: 0.8 },
  '/plan': { changeFrequency: 'monthly', priority: 0.8 },
  '/about': { changeFrequency: 'monthly', priority: 0.6 },
  '/contact': { changeFrequency: 'monthly', priority: 0.6 },
  '/faq': { changeFrequency: 'monthly', priority: 0.6 },
  '/legal/privacy': { changeFrequency: 'yearly', priority: 0.3 },
  '/legal/terms': { changeFrequency: 'yearly', priority: 0.3 },
  '/legal/mentions': { changeFrequency: 'yearly', priority: 0.3 },
  '/legal/rgpd': { changeFrequency: 'yearly', priority: 0.3 },
};
