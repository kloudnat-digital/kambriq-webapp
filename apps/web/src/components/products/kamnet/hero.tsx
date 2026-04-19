import { Network } from 'lucide-react';
import SharedHero from '@/components/hero';

const Hero = () => {
  return (
    <SharedHero
      Icon={Network}
      heroBadgeLabel={"KAMNET - Réseau d'Agents Certifiés"}
      title={"Rejoignez le réseau d'agents fonciers certifiés du Cameroun"}
      subtitle={
        "Développez votre activité d'agent foncier en vous appuyant sur l'expertise KAMBRIQ et accédez au catalogue exclusif de terrains vérifiés."
      }
      cta1={{ label: 'Devenir agent', href: '/kamnet/apply' }}
      cta2={{ label: 'Nous contacter', href: '/contact' }}
    />
  );
};

export default Hero;
