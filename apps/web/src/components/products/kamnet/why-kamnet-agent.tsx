import SectionHeader from '@/components/section/header';
import { cn } from '@/lib/utils';
import React from 'react';

const steps = [
  {
    id: 1,
    title: 'Parrainage',
    description:
      'Être parrainé par un Agent KAMNET existant ou demander directement une formation KBS',
  },
  {
    id: 2,
    title: 'Formation sur KBS',
    description:
      'Suivez les modules de formation et réussissez les QCM pour maîtriser tous les aspects du métier',
  },
  {
    id: 3,
    title: 'Certification KCA',
    description:
      'Obtenez votre certification KAMBRIQ Certified Agent après validation de la formation',
  },
  {
    id: 4,
    title: "Demande d'adhésion au KAMNET",
    description:
      'Soumettez votre dossier avec votre code de parrainage pour rejoindre officiellement le réseau',
  },
  {
    id: 5,
    title: 'Statut Agent Junior',
    description:
      "Démarrez votre activité avec le statut d'Agent Junior et premiers accès au catalogue",
  },
  {
    id: 6,
    title: 'Accompagnement par le parrain',
    description:
      "Bénéficiez de l'accompagnement personnalisé de votre parrain pour vos premières ventes",
  },
  {
    id: 7,
    title: 'Évolution vers un statut de manager',
    description:
      'Progressez dans votre carrière : Agent Confirmé (+5 ventes), Manager (+10 filleuls +10 ventes)',
  },
];

const WhyKamnetAgent = () => {
  return (
    <section className="border-t border-border/45 bg-background py-20 md:py-28">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title={"Parcours d'un Agent KAMNET"}
          subtitle={"De la formation à l'évolution professionnelle"}
        />

        <div className="mx-auto mt-10">
          <ul className="space-y-6">
            {steps.map(({ id, title, description }, index) => (
              <li key={id} className="relative flex gap-x-4">
                <div
                  className={cn(
                    index === steps.length - 1 ? 'h-6' : '-bottom-6',
                    'absolute top-0 left-0 flex w-8 justify-center',
                  )}
                >
                  <div className="w-px bg-accent-200" />
                </div>
                <div className="relative flex size-8 flex-none items-center justify-center bg-white">
                  <span className="flex size-6 items-center justify-center rounded-full bg-accent-700 text-accent-200 outline outline-accent-500">
                    <span className="">{index + 1}</span>
                  </span>
                </div>
                <div className="flex-auto rounded-lg p-3 ring-1 ring-gray-200 ring-inset">
                  <div className="py-0.5 text-sm/5 font-medium text-gray-900">{title}</div>
                  <p className="text-sm/6 text-gray-500">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default WhyKamnetAgent;
