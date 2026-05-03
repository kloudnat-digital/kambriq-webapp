import Link from 'next/link';
import { getLocale } from 'next-intl/server';

type Locale = 'fr' | 'en';

type Card = {
  href: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  regulators: Record<Locale, string>;
};

const CARDS: Card[] = [
  {
    href: '/legal/rgpd/ue',
    title: { fr: 'Union européenne', en: 'European Union' },
    description: {
      fr: 'France, Belgique, Luxembourg, Allemagne, Pays-Bas et autres États membres de l’UE.',
      en: 'France, Belgium, Luxembourg, Germany, Netherlands and other EU member states.',
    },
    regulators: {
      fr: 'RGPD - Règlement (UE) 2016/679',
      en: 'GDPR - Regulation (EU) 2016/679',
    },
  },
  {
    href: '/legal/rgpd/uk',
    title: { fr: 'Royaume-Uni', en: 'United Kingdom' },
    description: {
      fr: 'Résidents du Royaume-Uni post-Brexit.',
      en: 'United Kingdom residents (post-Brexit regime).',
    },
    regulators: {
      fr: 'UK GDPR + Data Protection Act 2018',
      en: 'UK GDPR + Data Protection Act 2018',
    },
  },
  {
    href: '/legal/rgpd/ch',
    title: { fr: 'Suisse', en: 'Switzerland' },
    description: {
      fr: 'Résidents de la Confédération helvétique.',
      en: 'Residents of the Swiss Confederation.',
    },
    regulators: {
      fr: 'nLPD - Loi fédérale sur la protection des données',
      en: 'FADP - Federal Act on Data Protection',
    },
  },
  {
    href: '/legal/rgpd/ca',
    title: { fr: 'Canada', en: 'Canada' },
    description: {
      fr: 'Résidents canadiens, avec règles spécifiques pour le Québec.',
      en: 'Canadian residents, with specific rules for Quebec.',
    },
    regulators: {
      fr: 'PIPEDA + Loi 25 (Québec)',
      en: 'PIPEDA + Quebec Law 25',
    },
  },
  {
    href: '/legal/rgpd/us-ca',
    title: { fr: 'Californie (États-Unis)', en: 'California (USA)' },
    description: {
      fr: 'Résidents de l’État de Californie.',
      en: 'Residents of the State of California.',
    },
    regulators: {
      fr: 'CCPA / CPRA - California Consumer Privacy Act',
      en: 'CCPA / CPRA - California Consumer Privacy Act',
    },
  },
  {
    href: '/legal/rgpd/global',
    title: { fr: 'Autres pays', en: 'Other countries' },
    description: {
      fr: 'Émirats arabes unis, Japon, Chine, Cameroun, Brésil, Afrique du Sud et autres juridictions.',
      en: 'United Arab Emirates, Japan, China, Cameroon, Brazil, South Africa and other jurisdictions.',
    },
    regulators: {
      fr: 'PDPL, APPI, PIPL, Loi camerounaise n°2010/012, LGPD, POPIA et autres',
      en: 'PDPL, APPI, PIPL, Cameroon Law No. 2010/012, LGPD, POPIA and others',
    },
  },
];

export const metadata = {
  title: 'Protection des données par juridiction | KAMBRIQ',
  description:
    'Politiques de protection des données KAMBRIQ par pays ou région : UE, UK, Suisse, Canada, Californie, autres juridictions.',
};

export default async function RgpdIndexPage() {
  const rawLocale = await getLocale();
  const locale: Locale = rawLocale === 'en' ? 'en' : 'fr';

  const heading =
    locale === 'fr' ? 'Protection des données par juridiction' : 'Data protection by jurisdiction';
  const lede =
    locale === 'fr'
      ? 'Choisissez votre pays ou région de résidence pour consulter la politique de protection des données qui vous concerne.'
      : 'Choose your country or region of residence to view the data protection policy that applies to you.';

  return (
    <>
      <h1 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        {heading}
      </h1>
      <p className="mb-10 leading-relaxed text-gray-600">{lede}</p>

      <ul className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="block h-full rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-primary-400 hover:bg-gray-50"
            >
              <h2 className="mb-1 text-lg font-semibold text-gray-900">{card.title[locale]}</h2>
              <p className="mb-2 text-sm text-gray-600">{card.description[locale]}</p>
              <p className="text-xs font-medium text-primary-700">{card.regulators[locale]}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
