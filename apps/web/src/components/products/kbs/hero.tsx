import { Award, GraduationCap } from 'lucide-react';
import SharedHero from '@/components/hero';

const Hero = () => {
  return (
    <SharedHero
      Icon={GraduationCap}
      heroBadgeLabel={'Formation professionnelle'}
      title={'Devenez agent KAMNET certifié'}
      subtitle={
        'KAMBRIQ Business School (KBS) est la formation de référence pour maîtriser le foncier camerounais et rejoindre le réseau KAMNET.'
      }
      cta1={{ label: 'Nous contacter', href: '/contact' }}
      cta2={{ label: 'En savoir plus sur KAMNET', href: '/products/kamnet' }}
    >
      <div className="mt-5 flex w-full items-center justify-center">
        <div className="flex max-w-lg items-center justify-center rounded-md bg-primary-100 px-6 py-2.5 outline outline-primary-700 sm:px-3.5">
          <div className="flex items-center gap-x-4 text-sm/6 text-primary-700">
            <Award className="size-5" />
            Obtenez votre certificat KCA (KAMBRIQ Certified Agent) en 2 mois
          </div>
        </div>
      </div>
    </SharedHero>
  );
};

export default Hero;
