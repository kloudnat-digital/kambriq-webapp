import SectionCard from '@/components/section/card';
import SectionCardContainer from '@/components/section/card/container';
import { Award, Orbit, Waypoints } from 'lucide-react';
import type { FC } from 'react';

const AdvantagesKCA: FC = () => {
  const advantages = [
    {
      Icon: Award,
      title: 'Certification reconnue',
      description:
        'Obtenez le certificat KCA (KAMBRIQ Certified Associate), valable 2 ans, attestant de votre expertise.',
    },
    {
      Icon: Waypoints,
      title: 'Accès au réseau KAMNET',
      description:
        "Rejoignez le réseau exclusif d'agents KAMBRIQ et accédez au catalogue de terrains titrés vérifiés.",
    },
    {
      Icon: Orbit,
      title: 'Expertise TDT/VEFL/VEFIL',
      description:
        'Maîtrisez les 3 labels KAMBRIQ et devenez expert en vérification et commercialisation foncière',
    },
  ] as const;
  return (
    <div className="py-6">
      <p className="mx-auto max-w-lg text-center text-4xl font-semibold tracking-tight text-balance text-gray-950 sm:text-5xl">
        Les bénéfices de la certification KCA
      </p>
      <SectionCardContainer
        className="mt-10 sm:mt-16 lg:mt-16 lg:max-w-5xl"
        containerClassName="lg:grid-cols-3"
      >
        {advantages.map(({ Icon, title, description }) => (
          <SectionCard
            key={title}
            Icon={Icon}
            title={title}
            description={description}
            className="border-black/15 bg-white"
            iconClassName="text-gold-700"
            iconContainerClassName="bg-gold-50 border border-gold-600/20"
          />
        ))}
      </SectionCardContainer>
    </div>
  );
};

export default AdvantagesKCA;
