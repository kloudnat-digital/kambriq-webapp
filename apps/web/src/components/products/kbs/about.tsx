import SectionHeader from '@/components/section/header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Goal } from 'lucide-react';
import React from 'react';
import WhoCanRegisterKBS from './who-can register';
import AdvantagesKCA from './advantages-kca';

const AboutKBS = () => {
  return (
    <section className="relative overflow-hidden border-t border-border/45 bg-white py-20 md:py-28">
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title={"Qu'est-ce que KAMBRIQ Business School ?"}
          subtitle={
            "KAMBRIQ Business School (KBS) est le centre de formation officiel pour devenir Agent KAMNET certifié. Notre programme intensif de 8 semaines vous prépare à maîtriser le marché foncier camerounais et à réussir dans le réseau d'agents KAMBRIQ."
          }
        />

        <div className="flex items-center justify-center py-10">
          <Alert className="max-w-4xl border-accent-600/20 bg-accent-50">
            <Goal className="size-5 text-accent-700!" />
            <AlertTitle className="text-lg text-accent-700">Notre mission</AlertTitle>
            <AlertDescription className="text-base text-accent-700">
              Former des professionnels compétents et éthiques capables d'accompagner les
              investisseurs (diaspora et locaux) dans leurs projets fonciers au Cameroun, tout en
              garantissant sécurité juridique et transparence.
            </AlertDescription>
          </Alert>
        </div>

        <WhoCanRegisterKBS />
        <AdvantagesKCA />
      </div>
    </section>
  );
};

export default AboutKBS;
