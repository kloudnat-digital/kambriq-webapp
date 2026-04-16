import SectionCard from '@/components/section/card';
import SectionCardContainer from '@/components/section/card/container';
import SectionHeader from '@/components/section/header';
import { ChartSpline, Headset, HeartHandshake, Waypoints } from 'lucide-react';
import React from 'react';

const WhyKBS = () => {
  const features = [
    {
      Icon: Waypoints,
      title: 'Rejoindre le réseau KAMNET',
      description:
        'Devenez Agent KAMNET certifié et accédez à notre catalogue exclusif de terrains titrés',
    },
    {
      Icon: ChartSpline,
      title: 'Revenus complémentaires',
      description: 'Générez des commissions attractives sur chaque vente réalisée via le réseau.',
    },
    {
      Icon: HeartHandshake,
      title: 'Expertise reconnue',
      description:
        'Certificat KCA reconnu, valable 2 ans, attestant de vos compétences en foncier camerounais.',
    },
    {
      Icon: Headset,
      title: 'Accompagnement continu',
      description: "Support KAMBRIQ 7j/7 et accès à une communauté d'agents expérimentés.",
    },
  ] as const;

  return (
    <section className="border-t border-border/45 bg-background py-20 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title={'Pourquoi se former ?'}
          subtitle={
            'La formation KBS vous ouvre les portes du réseau KAMNET et de nouvelles opportunités'
          }
        />
        <SectionCardContainer>
          {features.map(({ Icon, title, description }) => (
            <SectionCard key={title} Icon={Icon} title={title} description={description} />
          ))}
        </SectionCardContainer>
      </div>
    </section>
  );
};

export default WhyKBS;
