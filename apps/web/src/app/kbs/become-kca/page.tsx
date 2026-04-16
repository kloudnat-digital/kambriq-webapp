import Link from 'next/link';
import { GraduationCap, CheckCircle } from 'lucide-react';

import Navbar from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';

const BENEFITS = [
  'Accès à la plateforme de gestion clients KAMBRIQ',
  'Commission sur chaque vente (3% à 7% selon niveau)',
  'Formation continue et mises à jour',
  "Support et mentoring d'agents experts",
  'Badge certifié visible par les clients diaspora',
  'Accès prioritaire aux nouveaux terrains',
];

const STEPS = [
  { num: 1, title: 'Inscription KBS', desc: 'Créez votre compte et accédez à la formation.' },
  { num: 2, title: 'Formation 6 modules', desc: 'Suivez les 6 modules à votre rythme (3-6 mois).' },
  {
    num: 3,
    title: 'Examen de certification',
    desc: "Passez l'examen final (score minimum : 60%).",
  },
  { num: 4, title: 'Certification KCA', desc: 'Recevez votre certificat et votre numéro KCA.' },
  { num: 5, title: 'Intégration KAMNET', desc: 'Rejoignez le réseau et commencez à vendre.' },
];

export default function BecomeKcaPage() {
  return (
    <>
      <Navbar />
      <main className="pt-[73px]">
        <section className="bg-gradient-to-br from-blue-900 to-primary-800 px-6 py-24 text-white sm:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <GraduationCap className="mx-auto mb-6 size-16 text-blue-300" />
            <h1 className="mb-6 text-4xl font-bold sm:text-5xl">Devenez KCA</h1>
            <p className="mb-8 text-lg text-blue-100">
              KAMBRIQ Certified Agent — La certification qui ouvre les portes du réseau immobilier
              diaspora le plus performant d&apos;Afrique centrale.
            </p>
            <Button asChild size="lg" className="bg-white text-blue-900 hover:bg-blue-50">
              <Link href="/kbs/apply">Commencer la formation</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-20 sm:px-8">
          <h2 className="mb-10 text-center text-2xl font-bold">Le parcours KCA en 5 étapes</h2>
          <ol className="relative border-l border-primary-200">
            {STEPS.map((step) => (
              <li key={step.num} className="mb-8 ml-6 last:mb-0">
                <span className="absolute -left-3.5 flex size-7 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white ring-4 ring-white">
                  {step.num}
                </span>
                <h3 className="font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{step.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-gray-50 px-6 py-20 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-10 text-center text-2xl font-bold">Avantages de la certification</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {BENEFITS.map((b) => (
                <div key={b} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm">
                  <CheckCircle className="mt-0.5 size-5 shrink-0 text-success" />
                  <p className="text-sm text-gray-700">{b}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Button asChild size="lg">
                <Link href="/kbs/apply">Postuler maintenant</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
