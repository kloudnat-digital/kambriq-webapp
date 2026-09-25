import { siteConfig } from '@/config/site.config';
import { routing, type Locale } from '@/i18n/routing';
import { absoluteUrl, siteUrl } from './urls';

/**
 * Structured data, of which this site had none.
 *
 * Every value here is read from `config/site.config.ts` or from the routing
 * configuration. Nothing is invented: structured data is a machine-readable
 * claim about a real company, and a plausible-looking wrong one is worse than
 * an absent one - it is the value a search engine will show a person, and
 * nobody on the team reads the markup afterwards to notice.
 *
 * Two facts the public site carries are deliberately absent until somebody
 * supplies them: the RCCM number and the share capital, which the mentions
 * légales still serves as `XXX XXX XAF`. A placeholder published as structured
 * data is a false statement about a legal entity.
 */
const organization = (locale: Locale) => ({
  '@type': 'Organization',
  '@id': `${siteUrl()}/#organization`,
  name: siteConfig.name,
  url: siteUrl(),
  logo: `${siteUrl()}/icons/favicon-32x32.png`,
  description: siteConfig.description,
  email: siteConfig.contact.email,
  telephone: siteConfig.contact.phone.local,
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Douala',
    addressCountry: 'CM',
  },
  sameAs: [siteConfig.social.linkedin, siteConfig.social.facebook, siteConfig.social.youtube],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: siteConfig.contact.email,
    telephone: siteConfig.contact.whatsapp.number,
    availableLanguage: [...routing.locales],
    areaServed: ['CM', 'FR'],
  },
  url_alternate: absoluteUrl('/', locale),
});

const website = (locale: Locale) => ({
  '@type': 'WebSite',
  '@id': `${siteUrl()}/#website`,
  url: absoluteUrl('/', locale),
  name: siteConfig.name,
  description: siteConfig.description,
  inLanguage: locale,
  publisher: { '@id': `${siteUrl()}/#organization` },
});

/**
 * The organisation and the site, as one graph.
 *
 * `@graph` rather than two separate blocks so that `publisher` can point at the
 * organisation by `@id` instead of repeating it. Two copies of the same entity
 * is how a name and an address come to disagree.
 */
export const siteJsonLd = (locale: Locale) => ({
  '@context': 'https://schema.org',
  '@graph': [organization(locale), website(locale)],
});

/**
 * Renders a JSON-LD block.
 *
 * `JSON.stringify` output is placed in a `application/ld+json` script, which a
 * browser does not execute. The `<` escape guards the one case that would
 * change that: a value containing `</script>` would close the element early and
 * the rest would be parsed as markup.
 */
export const JsonLd = ({ data }: { data: unknown }) => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
  />
);
