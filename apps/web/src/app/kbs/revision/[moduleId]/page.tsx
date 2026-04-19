import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';

import Navbar from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const FLASHCARDS = [
  {
    term: 'TFL',
    definition:
      'Titre Foncier Loti — Le terrain possède un titre foncier individuel. Sécurité maximale.',
  },
  {
    term: 'VEFL',
    definition:
      'Vente En État Futur de Livraison — Terrain en cours de lotissement dont le titre sera fourni à la livraison.',
  },
  {
    term: 'VEFIL',
    definition:
      "Vente En État Futur d'Immatriculation et de Lotissement — Double processus d'immatriculation et lotissement en cours.",
  },
  {
    term: 'Titre foncier',
    definition:
      "Document officiel certifiant la propriété d'un bien immobilier. Au Cameroun, il est délivré par le Ministère des Domaines.",
  },
  {
    term: 'Acompte de réservation',
    definition:
      'Montant minimum de 5% du prix de vente requis pour réserver officiellement un terrain KAMBRIQ.',
  },
];

export default function ModuleRevisionPage({ params }: { params: { moduleId: string } }) {
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
          <div className="mb-8 flex items-center gap-3">
            <BookOpen className="size-6 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              Révision — Module {params.moduleId}
            </h1>
          </div>
          <div className="space-y-4">
            {FLASHCARDS.map((card) => (
              <Card key={card.term}>
                <CardContent className="p-5">
                  <p className="mb-2 text-sm font-bold text-primary-600">{card.term}</p>
                  <p className="text-sm text-gray-700">{card.definition}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8 flex gap-3">
            <Button asChild className="flex-1">
              <Link href={`/kbs/exam`}>Passer l&apos;examen</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/kbs/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
