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

export const FaqContent = () => {
  const t = useTranslations('faq');
  const [search, setSearch] = useState('');
  const items = t.raw('items') as FaqItem[];

  const filtered = items.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q);
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-16 sm:px-8">
      <div className="relative">
        <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gray-400" />
        <Input
          className="pl-10"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

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
