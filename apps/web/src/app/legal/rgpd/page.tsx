const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="mb-3 text-lg font-semibold text-gray-900">{title}</h2>
    <div className="text-sm leading-relaxed text-gray-600">{children}</div>
  </section>
);

const COUNTRIES = [
  { name: 'France', framework: 'RGPD (UE 2016/679)', authority: 'CNIL', contact: 'www.cnil.fr' },
  {
    name: 'Belgique',
    framework: 'RGPD (UE 2016/679)',
    authority: 'APD',
    contact: 'www.autoriteprotectiondonnees.be',
  },
  {
    name: 'Canada',
    framework: 'PIPEDA / Loi 25 (Québec)',
    authority: 'CPVP',
    contact: 'www.priv.gc.ca',
  },
  { name: 'Cameroun', framework: 'Loi n°2010/012', authority: 'ANTIC', contact: 'www.antic.cm' },
];

export default function RgpdPage() {
  return (
    <>
      <h1 className="mb-2 text-3xl font-bold text-gray-900">
        RGPD & Protection des données par pays
      </h1>
      <p className="mb-8 text-sm text-gray-400">
        KAMBRIQ opère dans plusieurs pays et respecte les réglementations locales de protection des
        données.
      </p>
      {COUNTRIES.map((country) => (
        <Section key={country.name} title={country.name}>
          <ul className="space-y-1">
            <li>
              <span className="font-medium text-gray-700">Cadre réglementaire :</span>{' '}
              {country.framework}
            </li>
            <li>
              <span className="font-medium text-gray-700">Autorité compétente :</span>{' '}
              {country.authority}
            </li>
            <li>
              <span className="font-medium text-gray-700">Ressource :</span> {country.contact}
            </li>
          </ul>
          <p className="mt-3">
            KAMBRIQ respecte intégralement les obligations de traitement des données personnelles
            dans ce pays, y compris les droits d&apos;accès, rectification et suppression.
          </p>
        </Section>
      ))}
      <Section title="Contact DPO">
        <p>
          Pour toute question relative à la protection de vos données, contactez notre Délégué à la
          Protection des Données :{' '}
          <a href="mailto:dpo@kambriq.com" className="text-primary-600 hover:underline">
            dpo@kambriq.com
          </a>
        </p>
      </Section>
    </>
  );
}
