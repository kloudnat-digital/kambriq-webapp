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

const CATEGORIES = ['all', 'lands', 'verify', 'kbs', 'kamnet'] as const;
type Category = (typeof CATEGORIES)[number];

type FaqItem = { id: string; category: Exclude<Category, 'all'>; q: string; a: string };

const FAQ_ITEMS: FaqItem[] = [
  {
    id: '1',
    category: 'lands',
    q: "Qu'est-ce que le TDT ?",
    a: "Le TDT (Terrain Déjà Titré) est un terrain disposant d'un titre foncier définitif, le niveau de sécurité juridique le plus élevé au Cameroun.",
  },
  {
    id: '2',
    category: 'lands',
    q: "Puis-je acheter depuis l'étranger ?",
    a: "Oui. KAMBRIQ accompagne les membres de la diaspora dans l'acquisition de terrains à distance, avec un agent dédié sur place.",
  },
  {
    id: '3',
    category: 'lands',
    q: 'Comment fonctionne la réservation ?',
    a: 'Un acompte minimum de 5% du prix de vente est requis pour réserver un terrain. Le reste peut être payé en plusieurs tranches selon accord.',
  },
  {
    id: '4',
    category: 'verify',
    q: "Qu'est-ce que KAMBRIQ Verify ?",
    a: "KAMBRIQ Verify est un service de vérification de titres fonciers qui analyse l'authenticité d'un document et émet un rapport officiel sous 72h.",
  },
  {
    id: '5',
    category: 'verify',
    q: 'Combien coûte une vérification ?',
    a: 'Le prix varie selon le type de vérification. Consultez notre page Verify pour les tarifs actuels.',
  },
  {
    id: '6',
    category: 'kbs',
    q: "Qu'est-ce que la KBS ?",
    a: 'La KAMBRIQ Business School est notre programme de formation certifiante pour devenir agent immobilier spécialisé en diaspora.',
  },
  {
    id: '7',
    category: 'kbs',
    q: 'Combien de temps dure la formation ?',
    a: 'La formation KBS comprend 6 modules et peut être complétée en 3 à 6 mois selon votre rythme.',
  },
  {
    id: '8',
    category: 'kamnet',
    q: "Qu'est-ce que KAMNET ?",
    a: "KAMNET est notre réseau d'agents certifiés (KCA) qui accompagnent les clients dans leurs projets immobiliers au Cameroun.",
  },
  {
    id: '9',
    category: 'kamnet',
    q: 'Comment devenir agent KAMNET ?',
    a: 'Complétez la formation KBS, obtenez votre certification KCA, puis rejoignez le réseau KAMNET pour commencer à gagner des commissions.',
  },
];

export const FaqContent = () => {
  const t = useTranslations('faq');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category>('all');

  const filtered = FAQ_ITEMS.filter((item) => {
    if (category !== 'all' && item.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q);
    }
    return true;
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

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              category === cat
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t(`categories.${cat}`)}
          </button>
        ))}
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
