const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="mb-3 text-lg font-semibold text-gray-900">{title}</h2>
    <div className="text-sm leading-relaxed text-gray-600">{children}</div>
  </section>
);

export default function TermsPage() {
  return (
    <>
      <h1 className="mb-2 text-3xl font-bold text-gray-900">
        Conditions Générales d&apos;Utilisation
      </h1>
      <p className="mb-8 text-sm text-gray-400">Dernière mise à jour : 1er janvier 2025</p>
      <Section title="1. Acceptation des conditions">
        <p>
          En accédant et en utilisant la plateforme KAMBRIQ, vous acceptez d&apos;être lié par ces
          conditions générales d&apos;utilisation.
        </p>
      </Section>
      <Section title="2. Services proposés">
        <p>
          KAMBRIQ propose des services d&apos;intermédiation immobilière, de vérification de titres
          fonciers, de formation certifiante (KBS) et d&apos;accès à un réseau d&apos;agents
          (KAMNET).
        </p>
      </Section>
      <Section title="3. Accès à la plateforme">
        <p>
          L&apos;accès à certains services nécessite la création d&apos;un compte. Vous êtes
          responsable de la confidentialité de vos identifiants de connexion.
        </p>
      </Section>
      <Section title="4. Obligations de l'utilisateur">
        <p>
          Vous vous engagez à utiliser la plateforme uniquement à des fins légales et à ne pas
          tenter de compromettre sa sécurité ou son intégrité.
        </p>
      </Section>
      <Section title="5. Limitation de responsabilité">
        <p>
          KAMBRIQ ne peut être tenu responsable des décisions d&apos;investissement prises sur la
          base des informations présentées sur la plateforme.
        </p>
      </Section>
      <Section title="6. Droit applicable">
        <p>
          Ces conditions sont régies par le droit camerounais. Tout litige sera soumis aux tribunaux
          compétents de Yaoundé.
        </p>
      </Section>
    </>
  );
}
