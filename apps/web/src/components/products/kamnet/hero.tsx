import { Network } from 'lucide-react';
import SharedHero from '@/components/hero';

const Hero = () => {
  return (
    <SharedHero
      Icon={Network}
      heroBadgeLabel={"KAMNET - Réseau d'Agents Certifiés"}
      title={"Rejoignez le premier réseau d'agents fonciers certifiés du Cameroun"}
      subtitle={
        "Développez votre activité d'agent immobilier en vous appuyant sur l'expertise KAMBRIQ et accédez à un portefeuille exclusif de terrains titrés."
      }
      cta1={{ label: 'Devenir agent', href: '/kbs/apply' }}
      cta2={{ label: 'Contacter un agent', href: '/kbs/become-kca' }}
    />
  );
};

export default Hero;
