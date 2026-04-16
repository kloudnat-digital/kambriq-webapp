import React from 'react';
import { CheckIcon } from 'lucide-react';

const requirements = [
  {
    id: 'requirements',
    title: 'Prérequis',
    description: 'Ce dont vous avez besoin pour commencer',
    content: [
      'Motivation pour le secteur foncier et immobilier',
      'Connexion internet stable',
      'Disponibilité de 5-10 heures par semaine',
      'Aucun diplôme spécifique requis',
    ],
  },
];

const ExamRequirements = () => {
  return (
    <div className="container mx-auto grid max-w-md grid-cols-1 px-4 sm:px-6 lg:px-8">
      {requirements.map((requirement) => (
        <div
          key={requirement.id}
          className="flex flex-col justify-between rounded-lg bg-gold-50 p-5 shadow-xs outline outline-gold-700 sm:p-6"
        >
          <div>
            <p className="text-3xl font-semibold tracking-tight text-gold-900">
              {requirement.title}
            </p>
            <p className="mt-2 text-base/7 text-gold-700">{requirement.description}</p>
            <ul className="mt-8 space-y-4 text-sm/6 text-gold-800">
              {requirement.content.map((feature) => (
                <li key={feature} className="flex gap-x-3">
                  <CheckIcon aria-hidden="true" className="h-6 w-5 flex-none text-gold-600" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ExamRequirements;
