import { ChartNoAxesCombined, GraduationCap, Headset, ShoppingBag } from 'lucide-react';

const features = [
  {
    id: 'exclusive-access',
    Icon: ShoppingBag,
    title: 'Accès exclusif aux produits KAMBRIQ Lands',
    description:
      'Distribuez les terrains TDT, VEFIL et VEFL en exclusivité et accédez aux futurs produits KCPI, maisons et lotissements',
  },
  {
    id: 'attractive-commissions',
    Icon: ChartNoAxesCombined,
    title: 'Commissions attractives (PV, TPC)',
    description:
      'Système de commissionnement à plusieurs niveaux avec Points Valeur et Taux Personnel de Commissionnement avantageux',
  },
  {
    id: 'certified-training',
    Icon: GraduationCap,
    title: 'Formation certifiante KCA (via KBS)',
    description:
      'Obtenez votre certification KAMBRIQ Certified Agent grâce à notre programme de formation professionnelle complet',
  },
  {
    id: 'agent-follow-up',
    Icon: Headset,
    title: 'Accompagnement des Agents',
    description:
      'Bénéficiez du soutien de votre parrain et de la communauté KAMNET pour développer votre activité',
  },
  {
    id: 'professional-opportunity',
    Icon: Headset,
    title: 'Opportunité professionnelle stable',
    description:
      "Construisez une carrière durable dans l'immobilier avec un modèle économique éprouvé",
  },
];

const WhyKambriqAgent = () => {
  return (
    <section className="relative overflow-hidden border-t border-border/45 bg-white py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-5">
          <div className="col-span-2">
            <p className="text-4xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-5xl">
              Pourquoi devenir Agent KAMBRIQ ?
            </p>
            <p className="mt-6 text-base/7 text-gray-700">
              Rejoignez un réseau professionnel en pleine croissance
            </p>
          </div>
          <dl className="col-span-3 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2">
            {features.map(({ id, Icon, title, description }) => (
              <div key={id}>
                <dt className="text-base/7 font-semibold text-gray-900">
                  <div className="mb-6 flex size-10 items-center justify-center rounded-lg bg-primary-600">
                    <Icon className="size-5 text-white" />
                  </div>
                  {title}
                </dt>
                <dd className="mt-1 text-base/7 text-gray-600">{description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
};

export default WhyKambriqAgent;
