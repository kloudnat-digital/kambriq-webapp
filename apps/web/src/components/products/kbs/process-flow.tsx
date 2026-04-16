import { CalendarRange, BookOpenCheck, Award, HatGlasses } from 'lucide-react';
import SectionHeader from '@/components/section/header';
import StepsContainer from '../../steps';
import Step from '../../steps/step';

const ProcessFlow = () => {
  const steps = [
    {
      Icon: CalendarRange,
      number: '01',
      title: '2 mois de formation',
      description:
        'Parcours complet en ligne : modules théoriques, cas pratiques, et accompagnement personnalisé.',
    },
    {
      Icon: BookOpenCheck,
      number: '02',
      title: 'Examen KCA',
      description:
        'Évaluation finale pour valider vos compétences et connaissances du foncier camerounais.',
    },
    {
      Icon: Award,
      number: '03',
      title: 'Certification',
      description: 'Obtenez votre certificat KCA (KAMBRIQ Certified Agent), valable 2 ans.',
    },
    {
      Icon: HatGlasses,
      number: '04',
      title: 'Activation Agent KAMNET',
      description:
        'Rejoignez officiellement le réseau KAMNET et commencez à vendre nos terrains titrés.',
    },
  ] as const;

  return (
    <section className="bg relative overflow-hidden border-t border-border/45 py-20 md:py-28">
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title={'Comment se passe le parcours ?'}
          subtitle={'4 étapes pour devenir Agent KAMNET certifié'}
        />
        <StepsContainer>
          {steps.map(({ Icon, number, title, description }, index) => (
            <Step
              key={number}
              Icon={Icon}
              stepLabel={number}
              isLast={index === steps.length - 1}
              title={title}
              description={description}
            />
          ))}
        </StepsContainer>
      </div>
    </section>
  );
};

export default ProcessFlow;
