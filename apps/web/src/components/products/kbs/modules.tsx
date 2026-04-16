import SectionHeader from '@/components/section/header';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Check, Clock } from 'lucide-react';
import React from 'react';

const modules = [
  {
    id: 1,
    name: 'Module 1',
    title: 'Fondamentaux du foncier camerounais',
    duration: '1 semaine',
    description: 'Donner les bases foncières essentielles aux futurs Agents KAMNET.',
    lectures: [
      {
        title: 'Introduction au système foncier camerounais',
        description:
          "Comprendre l'historique, les institutions et la complexité du foncier au Cameroun.",
      },
      {
        title: 'Les 3 catégories de terrains commercialisables par KAMBRIQ',
        description: 'Différencier les terrains TDT, VEFL et VEFIL.',
      },
      {
        title: 'Pourquoi KAMBRIQ se limite à ces 3 catégories',
        description: 'Sécurité, traçabilité, cohérence commerciale.',
      },
      {
        title: 'Risques courants dans le foncier',
        description: 'Identifier les pièges majeurs pour mieux les éviter.',
      },
    ],
  },
  {
    id: 2,
    name: 'Module 2',
    title: 'Le Titre Foncier (TDT) : comprendre, lire, vérifier',
    duration: '1 semaine',
    description: "Permettre à l'agent de lire, interpréter et vérifier un Titre Foncier simple.",
    lectures: [
      {
        title: "Qu'est-ce qu'un Titre Foncier ?",
        description:
          'Comprendre le rôle et la définition du Titre Foncier dans le système foncier camerounais.',
      },
      {
        title: "Anatomie d'un Titre Foncier",
        description: 'Savoir lire champ par champ un Titre Foncier.',
      },
      {
        title: 'Vérifier un Titre Foncier',
        description:
          'Mettre en place une méthode simple pour vérifier un TF avant de le proposer à un client.',
      },
      {
        title: 'Cas pratiques et erreurs fréquentes',
        description: "Identifier les signaux d'alerte à partir d'exemples concrets.",
      },
    ],
  },
  {
    id: 3,
    name: 'Module 3',
    title: 'VEFL & VEFIL : comprendre & vendre les projets en cours',
    duration: '3 semaines',
    description:
      "Permettre à l'agent de comprendre et d'expliquer clairement les offres VEFL et VEFIL de KAMBRIQ, leurs processus administratifs, leurs risques et leurs avantages commerciaux.",
    lectures: [
      {
        title: 'Introduction générale',
        description:
          'Comprendre pourquoi VEFL et VEFIL représentent 80% du marché foncier réel et pourquoi KAMBRIQ les propose.',
      },
      {
        title: 'VEFL : Vente en État Futur de Lotissement',
        description:
          'Maîtriser le processus VEFL, ses documents obligatoires, les risques associés et les contrôles KAMBRIQ.',
      },
      {
        title: "VEFIL : Vente en État Futur d'Immatriculation & Lotissement",
        description:
          'Comprendre le processus VEFIL, ses documents, les risques plus élevés et les contrôles renforcés de KAMBRIQ.',
      },
      {
        title: 'Comparatif VEFL / VEFIL / TDT',
        description:
          'Tableau comparatif des trois catégories de terrains KAMBRIQ selon les critères clés.',
      },
      {
        title: 'Checklists professionnelles',
        description:
          'Listes de vérification essentielles pour valider un dossier VEFL ou VEFIL avant présentation au client.',
      },
      {
        title: 'Mini-Examen Module 3',
        description:
          'Évaluation des connaissances acquises sur VEFL et VEFIL : procédures, risques, analyses documentaires.',
      },
    ],
  },
  {
    id: 4,
    name: 'Module 4',
    title: 'Techniques de commercialisation & argumentaire KAMBRIQ',
    duration: '2 semaines',
    description:
      "Former l'Agent KAMNET à présenter un terrain, rassurer un client, traiter les objections et conclure une vente en respectant la méthode KAMBRIQ.",
    lectures: [
      {
        title: 'Bases de la vente foncière KAMBRIQ',
        description:
          "Comprendre le rôle de l'Agent KAMNET, les profils clients et les 3 piliers de la méthode KAMBRIQ.",
      },
      {
        title: 'Comment présenter un terrain KAMBRIQ',
        description:
          "Structure de présentation d'un terrain selon son label (TDT, VEFL, VEFIL) et règles de présentation des documents.",
      },
      {
        title: 'Gérer les objections',
        description:
          'Techniques de réponse aux objections les plus courantes avec méthode structurée.',
      },
      {
        title: 'Scripts commerciaux KAMBRIQ',
        description: 'Scripts adaptés selon le profil client : diaspora, local, investisseur.',
      },
      {
        title: 'Processus de vente KAMNET',
        description:
          'Étapes obligatoires du processus de vente et interdictions absolues pour les agents.',
      },
      {
        title: 'Exercice pratique',
        description: 'Cas pratique de vente : client diaspora hésitant entre TDT et VEFL.',
      },
    ],
  },
  {
    id: 5,
    name: 'Module 5',
    title: 'Outils & plateforme KAMNET',
    duration: '2 semaines',
    description:
      "Former l'Agent KAMNET à maîtriser l'interface, la navigation, la réservation des terrains, le suivi des ventes et la gestion des commissions.",
    lectures: [
      {
        title: 'Introduction à la plateforme KAMNET',
        description:
          "Comprendre le rôle de KAMNET dans l'écosystème KAMBRIQ et le flux général d'utilisation.",
      },
      {
        title: 'Navigation de la plateforme',
        description:
          "Maîtriser le tableau de bord agent, l'accès aux terrains et la structure des fiches terrain.",
      },
      {
        title: 'Gestion des prospects',
        description: 'Apprendre à créer et gérer des prospects dans la plateforme KAMNET.',
      },
      {
        title: 'Réservations KAMNET',
        description: 'Maîtriser le processus de réservation et ses règles.',
      },
      {
        title: 'Suivi des ventes',
        description: 'Comprendre le pipeline de vente et les actions disponibles par rôle.',
      },
      {
        title: 'Commissions KAMNET',
        description: 'Comprendre le fonctionnement et le suivi des commissions.',
      },
    ],
  },
  {
    id: 6,
    name: 'Module 6',
    title: 'Éthique, Conformité & Marque KAMBRIQ',
    duration: '1 semaine',
    description:
      'Former les Agents KAMNET à respecter les règles déontologiques, protéger la marque KAMBRIQ, prévenir la fraude et garantir une expérience client exemplaire.',
    lectures: [
      {
        title: "Introduction à l'éthique KAMBRIQ",
        description:
          "Comprendre l'importance d'une éthique stricte dans le secteur foncier et l'engagement KAMNET.",
      },
      {
        title: 'Code de conduite KAMNET',
        description:
          "Découvrir les comportements attendus et interdits pour maintenir l'intégrité du réseau KAMNET.",
      },
      {
        title: 'Conformité & protection des données',
        description:
          'Maîtriser les règles de confidentialité et la gestion sécurisée des données clients.',
      },
      {
        title: 'Prévention de la fraude',
        description:
          'Identifier les types de fraude courants et apprendre à détecter et signaler les cas suspects.',
      },
      {
        title: 'Image & marque KAMBRIQ',
        description:
          'Comprendre le devoir de représentation et les règles de communication officielle.',
      },
      {
        title: 'Responsabilité professionnelle',
        description:
          "Maîtriser le devoir de diligence et l'engagement final de l'agent certifié KCA.",
      },
    ],
  },
];

const KBSModules = () => {
  return (
    <div className="py-20">
      <SectionHeader title={'Les modules de formation'} titleClassName="text-4xl sm:text-5xl" />

      <div className="mx-auto mt-16 max-w-4xl">
        <Accordion type="single" collapsible className="rounded-lg border border-accent-600/20">
          {modules.map((module) => (
            <AccordionItem
              key={module.id}
              value={module.title}
              className="rounded-none border-border bg-background px-6 first:rounded-t-lg last:rounded-b-lg last:border-b-0"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="relative pl-20 text-base/7 text-gray-600">
                  <div className="font-semibold text-gray-900">
                    <Badge className="absolute top-1 left-0 border border-gold-600 bg-gold-50 text-gold-700">
                      {module.name}
                    </Badge>
                    {module.title}
                  </div>
                  <div className="flex items-center gap-x-3">
                    <Clock className="size-4" />
                    <p>{module.duration}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-y-2 pb-6 text-base/7 leading-relaxed text-muted-foreground">
                <p>{module.description}</p>
                <div>
                  <p className="font-medium">Contenu du module :</p>
                  <div className="mt-2 flex flex-col gap-y-2">
                    {module.lectures.map((lecture) => (
                      <div className="relative pl-8 text-base/7">
                        <div className="font-semibold">
                          <Check className="absolute top-1 left-0 size-5 text-gold-700" />
                          {lecture.title}
                        </div>
                        {lecture.description}
                      </div>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
};

export default KBSModules;
