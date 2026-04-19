'use client';

import SectionHeader from '@/components/section/header';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { FC } from 'react';
import { useTranslations } from 'next-intl';

const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4'] as const;

const VerifyFAQ: FC = () => {
  const t = useTranslations('products.verify.faq');
  return (
    <section className="border-t border-border/45 bg-card py-20 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader title={t('title')} subtitle={t('subtitle')} />

        <div className="mx-auto mt-16 max-w-3xl">
          <Accordion type="single" collapsible className="space-y-4">
            {FAQ_KEYS.map((key) => (
              <AccordionItem
                key={key}
                value={key}
                className="rounded-lg border border-border bg-background px-6 last:border-b"
              >
                <AccordionTrigger className="py-6 text-left text-lg font-medium hover:no-underline">
                  {t(`${key}.question`)}
                </AccordionTrigger>
                <AccordionContent className="pb-6 text-base/7 leading-relaxed text-muted-foreground">
                  {t(`${key}.answer`)}
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
