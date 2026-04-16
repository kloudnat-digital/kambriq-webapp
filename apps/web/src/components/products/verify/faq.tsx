'use client';

import SectionHeader from '@/components/section/header';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { FC } from 'react';

const VERIFY_FAQ_ITEMS = [
  {
    key: 'q1',
    question: 'Combien de temps prend la vérification ?',
    answer:
      'La vérification complète prend entre 24 et 48 heures. Nous vous contactons dès que les résultats sont prêts.',
  },
  {
    key: 'q2',
    question: 'Quels documents vais-je recevoir ?',
    answer:
      "Vous recevrez obligatoirement un Certificat de Propriété de moins de 3 mois et un avis KAMBRIQ détaillé. D'autres documents peuvent être fournis selon la disponibilité (bordereau analytique, certificat d'urbanisme).",
  },
  {
    key: 'q3',
    question: "Le service est-il vraiment gratuit si j'achète via KAMBRIQ ?",
    answer:
      'Oui, si vous achetez un terrain KAMBRIQ Lands ou avec accompagnement KAMBRIQ, la vérification est entièrement offerte. Sinon, le tarif est de 99€ TTC.',
  },
  {
    key: 'q4',
    question: "Puis-je utiliser ce service pour un terrain n'importe où au Cameroun ?",
    answer:
      'Oui, KAMBRIQ Verify fonctionne pour tous les terrains titrés au Cameroun, quelle que soit la région.',
  },
] as const;

const VerifyFAQ: FC = () => {
  return (
    <section className="border-t border-border/45 bg-card py-20 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title={'Questions fréquentes'}
          subtitle={'Tout ce que vous devez savoir sur KAMBRIQ Verify'}
        />

        <div className="mx-auto mt-16 max-w-3xl">
          <Accordion type="single" collapsible className="space-y-4">
            {VERIFY_FAQ_ITEMS.map((item) => (
              <AccordionItem
                key={item.key}
                value={item.key}
                className="rounded-lg border border-border bg-background px-6 last:border-b"
              >
                <AccordionTrigger className="py-6 text-left text-lg font-medium hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-6 text-base/7 leading-relaxed text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default VerifyFAQ;
