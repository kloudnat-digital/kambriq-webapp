'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  BookOpen,
  MapPin,
  ShieldCheck,
  CreditCard,
  GraduationCap,
  HelpCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const CATEGORIES = [
  { key: 'start', icon: HelpCircle, color: 'bg-primary-500/10 text-primary-600' },
  { key: 'lands', icon: MapPin, color: 'bg-gold-500/10 text-gold-600' },
  { key: 'verify', icon: ShieldCheck, color: 'bg-success/10 text-success' },
  { key: 'payment', icon: CreditCard, color: 'bg-accent-500/10 text-accent-600' },
  { key: 'kbs', icon: GraduationCap, color: 'bg-blue-100 text-blue-600' },
];

const QUICK_FAQS = [
  {
    id: '1',
    q: 'Comment puis-je acheter un terrain depuis la diaspora ?',
    a: 'Créez un compte, sélectionnez un terrain, et votre agent attitré vous guidera pour la réservation à distance.',
  },
  {
    id: '2',
    q: "Quels documents sont nécessaires pour l'achat ?",
    a: "Une pièce d'identité, un justificatif de domicile et un compromis de vente signé sont requis.",
  },
  {
    id: '3',
    q: 'Comment fonctionne le paiement échelonné ?',
    a: 'Un acompte de 5% minimum est requis. Le solde peut être payé en tranches selon un calendrier convenu.',
  },
  {
    id: '4',
    q: 'Le titre foncier est-il garanti ?',
    a: 'Oui, pour tous les terrains TDT. Pour les VEFL et VEFIL, le titre est garanti contractuellement.',
  },
  {
    id: '5',
    q: 'Comment contacter mon agent ?',
    a: 'Depuis votre dashboard client, rubrique "Mon Agent", vous trouverez ses coordonnées et son WhatsApp.',
  },
  {
    id: '6',
    q: 'Que faire en cas de litige ?',
    a: 'Contactez notre support via contact@kambriq.com ou WhatsApp. Un médiateur vous sera assigné sous 24h.',
  },
];

export const HelpContent = () => {
  const t = useTranslations('help');
  const [search, setSearch] = useState('');

  return (
    <div className="mx-auto max-w-5xl space-y-16 px-6 py-16 sm:px-8">
      {/* Search */}
      <div className="text-center">
        <h2 className="mb-6 text-2xl font-bold">{t('searchTitle')}</h2>
        <div className="relative mx-auto max-w-xl">
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-10"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {CATEGORIES.map(({ key, icon: Icon, color }) => (
          <button
            key={key}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-6 text-center transition-shadow hover:shadow-md"
          >
            <div className={`flex size-12 items-center justify-center rounded-xl ${color}`}>
              <Icon className="size-6" />
            </div>
            <span className="text-sm font-medium text-gray-700">{t(`categories.${key}`)}</span>
          </button>
        ))}
      </div>

      {/* FAQ */}
      <div>
        <h2 className="mb-6 text-xl font-bold">{t('faqTitle')}</h2>
        <Accordion type="multiple" className="space-y-2">
          {QUICK_FAQS.filter(
            (item) =>
              !search ||
              item.q.toLowerCase().includes(search.toLowerCase()) ||
              item.a.toLowerCase().includes(search.toLowerCase()),
          ).map((item) => (
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
      </div>

      {/* Contact support */}
      <div className="rounded-2xl border border-border bg-primary-500/5 p-8 text-center">
        <BookOpen className="mx-auto mb-4 size-10 text-primary-600" />
        <h2 className="mb-2 text-xl font-bold">{t('contactSupport.title')}</h2>
        <p className="mb-6 text-sm text-gray-500">{t('contactSupport.subtitle')}</p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/contact">{t('contactSupport.cta')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/faq">{t('contactSupport.faq')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
