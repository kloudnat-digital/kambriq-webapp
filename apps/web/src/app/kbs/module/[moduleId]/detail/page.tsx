import Link from 'next/link';
import { ArrowLeft, BookOpen, Clock, Target } from 'lucide-react';

import Navbar from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';

export default function ModuleDetailPage({ params }: { params: { moduleId: string } }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <div className="mx-auto max-w-3xl px-6 py-10 sm:px-8">
          <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
            <Link href={`/kbs/module/${params.moduleId}`}>
              <ArrowLeft className="size-4" /> Module
            </Link>
          </Button>
          <h1 className="mb-2 text-2xl font-bold">Fondamentaux du marché foncier camerounais</h1>
          <p className="mb-8 text-gray-500">
            Vue d&apos;ensemble des objectifs, du contenu et des prérequis de ce module.
          </p>

          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: BookOpen, label: '6 leçons', sub: '3 vidéos + 2 textes + 1 quiz' },
              { icon: Clock, label: '2h 30 min', sub: 'Durée estimée' },
              { icon: Target, label: 'Objectifs', sub: '5 compétences à acquérir' },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="rounded-xl border border-border bg-white p-4 text-center">
                <Icon className="mx-auto mb-2 size-5 text-primary-600" />
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-gray-400">{sub}</p>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <section>
              <h2 className="mb-3 text-lg font-semibold">Description</h2>
              <p className="text-sm leading-relaxed text-gray-600">
                Ce module introduit les fondamentaux du marché foncier camerounais. Vous découvrirez
                les acteurs clés, le cadre légal, les types de propriété et les mécanismes
                d&apos;évaluation foncière. À la fin de ce module, vous serez en mesure
                d&apos;accompagner un client dans la compréhension des bases de l&apos;acquisition
                foncière au Cameroun.
              </p>
            </section>
            <section>
              <h2 className="mb-3 text-lg font-semibold">Objectifs pédagogiques</h2>
              <ul className="space-y-2 text-sm text-gray-600">
                {[
                  'Identifier les acteurs du marché foncier camerounais',
                  'Comprendre les types de titres fonciers',
                  'Maîtriser le cadre légal et réglementaire',
                  "Évaluer les risques d'une transaction",
                  'Accompagner un client diaspora dans son projet',
                ].map((obj) => (
                  <li key={obj} className="flex items-start gap-2">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary-500" />
                    {obj}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="mt-8">
            <Button asChild className="w-full">
              <Link href={`/kbs/module/${params.moduleId}`}>Accéder au module</Link>
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
