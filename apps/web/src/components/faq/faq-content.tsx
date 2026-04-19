'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type FaqItem = { id: string; q: string; a: string };

const FAQ_ITEMS: FaqItem[] = [
  {
    id: '1',
    q: "Qu'est-ce que KAMBRIQ ?",
    a: "KAMBRIQ est un conseil en stratégie foncière au Cameroun. Nous ne vendons pas de terrains — nous vérifions, sécurisons et accompagnons votre projet d'acquisition foncière.",
  },
  {
    id: '2',
    q: "Comment acheter un terrain depuis l'étranger ?",
    a: "Contactez-nous par WhatsApp (+33 7 45 90 98 56) ou par email (contact@kambriq.com). Un agent KAMNET certifié vous accompagne de la sélection du terrain jusqu'à l'obtention de votre titre foncier.",
  },
  {
    id: '3',
    q: "C'est quoi un titre foncier ?",
    a: "C'est le seul document qui prouve que vous êtes propriétaire d'un terrain au Cameroun. Il est délivré par l'État, numéroté, et enregistré dans un livre foncier officiel.",
  },
  {
    id: '4',
    q: "Qu'est-ce que le domaine national ?",
    a: "C'est la catégorie foncière qui couvre plus de 95% du territoire camerounais. Sur le domaine national, personne n'est propriétaire — même pas le vendeur. Pour devenir propriétaire, il faut passer par l'immatriculation foncière.",
  },
  {
    id: '5',
    q: 'Que signifient les labels KAMBRIQ TFL™, VEFL™ et VEFIL™ ?',
    a: "Ce sont les 3 niveaux de sécurité de KAMBRIQ : KAMBRIQ TFL™ (le terrain a déjà un titre foncier individuel — sécurité maximale), KAMBRIQ VEFL™ (un titre foncier mère existe, le morcellement est en cours), KAMBRIQ VEFIL™ (le terrain est sur le domaine national, le processus d'immatriculation est à lancer ou en cours — risque plus élevé, accompagnement renforcé).",
  },
  {
    id: '6',
    q: "Qu'est-ce que KAMBRIQ VERIFY™ ?",
    a: "C'est notre service de vérification foncière. 7 points de contrôle sur chaque terrain. 99 € pour une vérification externe, gratuit si vous achetez via KAMBRIQ.",
  },
  {
    id: '7',
    q: 'Comment devenir agent KAMNET ?',
    a: 'En passant la certification KCA via KAMBRIQ Business School (KBS). Formation en ligne, examen final (score minimum 85%), certificat numéroté valable 2 ans. Consultez la page KBS pour en savoir plus.',
  },
  {
    id: '8',
    q: 'KAMBRIQ est-il un vendeur de terrains ?',
    a: 'Non. KAMBRIQ est un conseil en stratégie foncière. Nous ne possédons pas les terrains. Notre rôle est de vérifier, sécuriser et accompagner.',
  },
];

export const FaqContent = () => {
  const t = useTranslations('faq');
  const [search, setSearch] = useState('');

  const filtered = FAQ_ITEMS.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q);
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-16 sm:px-8">
      {/* Search */}
      <div className="relative">
        <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gray-400" />
        <Input
          className="pl-10"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Items */}
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-gray-400">{t('noResults')}</p>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {filtered.map((item) => (
            <AccordionItem
              key={item.id}
              value={item.id}
              className="rounded-xl border border-border bg-white px-4"
            >
              <AccordionTrigger className="text-left text-sm font-medium">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-gray-600">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};
