const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="mb-3 text-lg font-semibold text-gray-900">{title}</h2>
    <div className="text-sm leading-relaxed text-gray-600">{children}</div>
  </section>
);

export default function PrivacyPage() {
  return (
    <>
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Politique de confidentialité</h1>
      <p className="mb-8 text-sm text-gray-400">Dernière mise à jour : 1er janvier 2025</p>
      <Section title="1. Données collectées">
        <p>
          Nous collectons les données que vous nous fournissez directement (nom, email, téléphone)
          ainsi que des données de navigation pour améliorer nos services.
        </p>
      </Section>
      <Section title="2. Utilisation des données">
        <p>
          Vos données sont utilisées pour vous fournir nos services, communiquer avec vous et
          améliorer notre plateforme. Elles ne sont jamais vendues à des tiers.
        </p>
      </Section>
      <Section title="3. Conservation des données">
        <p>
          Vos données sont conservées pendant la durée nécessaire à la fourniture de nos services et
          conformément aux obligations légales applicables.
        </p>
      </Section>
      <Section title="4. Vos droits">
        <p>
          Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement et de
          portabilité de vos données. Exercez ces droits en contactant privacy@kambriq.com.
        </p>
      </Section>
      <Section title="5. Cookies">
        <p>
          Nous utilisons des cookies essentiels au fonctionnement du site et des cookies analytiques
          pour mesurer l&apos;audience. Vous pouvez configurer vos préférences dans les paramètres.
        </p>
      </Section>
    </>
  );
}
