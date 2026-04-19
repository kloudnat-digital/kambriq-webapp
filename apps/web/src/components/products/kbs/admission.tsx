import SectionHeader from '@/components/section/header';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

const conditions = [
  {
    name: 'Sponsorship',
    id: 'sponsorship',
    title: 'Parrainage KAMNET',
    description:
      "Si vous êtes recommandé par un Agent KAMNET existant, vous bénéficiez d'un accès prioritaire avec un code parrain.",
  },
  {
    name: 'Free Application',
    id: 'free-application',
    title: 'Candidature libre',
    description:
      "Vous pouvez aussi candidater librement en remplissant le formulaire d'admission. Votre dossier sera étudié par notre équipe.",
  },
] as const;
const Admission = () => {
  return (
    <section className="border-t border-border/45 bg-background py-20 md:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title={'Programme de formation KAMBRIQ Business School'}
          subtitle={'6 modules complets pour devenir un Agent Certifié KAMBRIQ (KCA)'}
        />

        <div className="mx-auto mt-10 grid max-w-md grid-cols-1 gap-8 lg:max-w-4xl lg:grid-cols-2">
          {conditions.map((condition) => (
            <div
              key={condition.id}
              className="flex flex-col justify-between rounded-lg bg-white p-8 shadow-xs outline outline-gray-900/10 sm:p-10"
            >
              <div>
                <h3 id={condition.id} className="text-base/7 font-semibold text-primary-500">
                  {condition.name}
                </h3>
                <div className="mt-4">
                  <p className="text-3xl font-semibold tracking-tight text-gray-900">
                    {condition.title}
                  </p>
                </div>
                <p className="mt-2 text-base/7 text-gray-600">{condition.description}</p>
              </div>
            </div>
          ))}
          <div className="flex flex-col items-start gap-x-8 gap-y-6 rounded-3xl p-8 ring-1 ring-gray-900/10 sm:gap-y-10 sm:p-10 lg:col-span-2 lg:flex-row lg:items-center">
            <div className="lg:min-w-0 lg:flex-1">
              <h3 className="text-base/7 font-semibold text-primary-600">Tarif de la formation</h3>
              <p className="mt-1 text-base/7 text-gray-600">
                Formation complète de 2 mois + examen KCA + certificat valable 2 ans
              </p>
              <div className="mt-4 flex items-baseline gap-x-2">
                <span className="text-5xl font-semibold tracking-tight text-gray-900">249€</span>
                <span className="text-base/7 font-semibold text-gray-600">TTC</span>
              </div>
            </div>
            <Button asChild variant="outline" size="lg" className="h-9 font-semibold">
              <Link href="/kbs/enroll">
                Candidater maintenant <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Admission;
