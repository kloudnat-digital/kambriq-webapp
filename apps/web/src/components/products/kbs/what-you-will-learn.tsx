import SectionHeader from '@/components/section/header';
import { CheckIcon } from 'lucide-react';
import React from 'react';

const chapters = [
  {
    name: 'Chapitre 1',
    id: 'chapitre-1',
    title: 'Droit foncier et Juridique',
    description: 'Maîtrisez le cadre légal du foncier camerounais',
    content: [
      'Système foncier camerounais et acteurs clés',
      'Lecture et validation des titres fonciers',
      'Procédures cadastrales et administratives',
      'Prévention des risques et litiges fonciers',
    ],
  },
  {
    name: 'Chapitre 2',
    id: 'chapitre-2',
    title: "Processus d'acquisition",
    description: "Accompagnez vos clients dans l'achat sécurisé de terrains",
    content: [
      'Vérification pré-achat avec KAMBRIQ Verify',
      "Étapes de l'acquisition d'un TDT/VEFL/VEFIL",
      'Documentation requise et vérifications',
      'Accompagnement client et gestion administrative',
    ],
  },
  {
    name: 'Chapitre 3',
    id: 'chapitre-3',
    title: 'Techniques de vente',
    description: 'Développez vos compétences commerciales',
    content: [
      'Prospection et qualification des leads',
      'Argumentation produit TDT, VEFL, VEFIL',
      'Gestion des objections et closing',
      'Suivi client et fidélisation',
    ],
  },
  {
    name: 'Chapitre 4',
    id: 'chapitre-4',
    title: 'Utilisation de la plateforme',
    description: 'Maîtrisez les outils KAMNET',
    content: [
      'Navigation dans le catalogue terrains',
      'Gestion des prospects et pipeline',
      'Système de commissions (PV, TPC)',
      'Support réseau et collaboration',
    ],
  },
];

const WhatYouWillLearn = () => {
  return (
    <section className="border-t border-border/45 py-20 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title={"Qu'allez-vous apprendre ?"}
          subtitle={
            'Une formation complète couvrant tous les aspects essentiels pour réussir comme Agent KAMNET'
          }
        />

        <div className="mx-auto mt-10 grid max-w-md grid-cols-1 gap-8 lg:max-w-5xl lg:grid-cols-2">
          {chapters.map((chapter) => (
            <div
              key={chapter.id}
              className="flex flex-col justify-between rounded-lg bg-white p-8 shadow-xs outline outline-gray-900/10 sm:p-10"
            >
              <div>
                <h3 id={chapter.id} className="text-base/7 font-semibold text-primary-500">
                  {chapter.name}
                </h3>
                <div className="mt-4">
                  <p className="text-3xl font-semibold tracking-tight text-gray-900">
                    {chapter.title}
                  </p>
                </div>
                <p className="mt-2 text-base/7 text-gray-600">{chapter.description}</p>
                <ul className="mt-10 space-y-4 text-sm/6 text-gray-600">
                  {chapter.content.map((feature) => (
                    <li key={feature} className="flex gap-x-3">
                      <CheckIcon
                        aria-hidden="true"
                        className="h-6 w-5 flex-none text-primary-400"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhatYouWillLearn;
