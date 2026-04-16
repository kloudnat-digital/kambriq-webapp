import SectionHeader from '@/components/section/header';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

const ReadyToVerify = () => {
  return (
    <section className="relative overflow-hidden border-t border-border/45 bg-background py-20 md:py-28">
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title={'Prêt à vérifier votre terrain ?'}
          subtitle={
            'Commencez votre vérification dès maintenant et recevez vos résultats en 24-48h.'
          }
        />
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg" className="h-9">
            <Link href="/kamnet">Commencer la vérification</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="h-9 font-semibold text-gray-900 hover:bg-transparent hover:text-gray-900"
          >
            <Link href="/verify">
              Contacter un conseiller
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ReadyToVerify;
