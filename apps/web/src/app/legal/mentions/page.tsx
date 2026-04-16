const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="mb-3 text-lg font-semibold text-gray-900">{title}</h2>
    <div className="text-sm leading-relaxed text-gray-600">{children}</div>
  </section>
);

export default function MentionsLegalesPage() {
  return (
    <>
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Mentions légales</h1>
      <Section title="Éditeur du site">
        <p>KAMBRIQ SAS — Capital social : XXX XXX XAF</p>
        <p>Siège social : Yaoundé, Cameroun</p>
        <p>N° RCCM : XX / XXX / XX</p>
        <p>Email : contact@kambriq.com</p>
      </Section>
      <Section title="Directeur de la publication">
        <p>Le directeur de la publication est le Président Directeur Général de KAMBRIQ SAS.</p>
      </Section>
      <Section title="Hébergement">
        <p>
          Ce site est hébergé sur des serveurs cloud sécurisés. Les données sont stockées en
          conformité avec les réglementations en vigueur.
        </p>
      </Section>
      <Section title="Propriété intellectuelle">
        <p>
          Tout le contenu de ce site (textes, images, logos, graphiques) est la propriété exclusive
          de KAMBRIQ SAS et est protégé par les lois sur la propriété intellectuelle.
        </p>
      </Section>
      <Section title="Limitation de responsabilité">
        <p>
          KAMBRIQ SAS s&apos;efforce d&apos;assurer l&apos;exactitude des informations diffusées
          mais ne peut garantir l&apos;exhaustivité et l&apos;exactitude de ces informations.
        </p>
      </Section>
    </>
  );
}
