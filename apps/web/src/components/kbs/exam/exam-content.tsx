'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Question = { id: number; question: string; options: string[]; correctIndex: number };

const MOCK_EXAM: Question[] = [
  {
    id: 1,
    question: "Qu'est-ce que le TFL ?",
    options: [
      'Titre Foncier Loti',
      'Titre de Fondation Légale',
      'Transfert Foncier Libre',
      'Terrain Fiabilisé et Loti',
    ],
    correctIndex: 0,
  },
  {
    id: 2,
    question: 'Quel est le dépôt minimum pour réserver un terrain KAMBRIQ ?',
    options: ['1%', '3%', '5%', '10%'],
    correctIndex: 2,
  },
  {
    id: 3,
    question: 'Que signifie VEFL ?',
    options: [
      'Vente En Futur Lotissement',
      'Vente En État Futur de Livraison',
      'Vente Étatique Foncière Libre',
      'Aucune de ces réponses',
    ],
    correctIndex: 1,
  },
  {
    id: 4,
    question: 'Combien de modules comporte la formation KBS ?',
    options: ['4', '5', '6', '8'],
    correctIndex: 2,
  },
  {
    id: 5,
    question: 'Quelle autorité délivre les titres fonciers au Cameroun ?',
    options: ['KAMBRIQ', 'Mairie', 'Ministère des Domaines', 'Notaire'],
    correctIndex: 2,
  },
];

export const ExamContent = () => {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const score = submitted ? MOCK_EXAM.filter((q) => answers[q.id] === q.correctIndex).length : 0;

  const handleSubmit = () => {
    if (Object.keys(answers).length < MOCK_EXAM.length) {
      toast.error('Veuillez répondre à toutes les questions.');
      return;
    }
    setSubmitted(true);
    toast.success(`Examen terminé ! Score : ${score}/${MOCK_EXAM.length}`);
  };

  if (submitted) {
    const pct = Math.round((score / MOCK_EXAM.length) * 100);
    const passed = pct >= 60;
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div
          className={`mb-4 flex size-24 items-center justify-center rounded-3xl text-4xl font-bold text-white ${passed ? 'bg-success' : 'bg-red-500'}`}
        >
          {pct}%
        </div>
        <h2 className="mb-2 text-xl font-bold">
          {passed ? 'Félicitations !' : 'Essayez à nouveau'}
        </h2>
        <p className="mb-8 text-gray-500">
          Score : {score}/{MOCK_EXAM.length} ·{' '}
          {passed ? 'Module validé' : 'Score insuffisant (60% requis)'}
        </p>
        <div className="flex gap-3">
          <Button onClick={() => router.push('/kbs/dashboard')}>Retour au dashboard</Button>
          {!passed && (
            <Button
              variant="outline"
              onClick={() => {
                setSubmitted(false);
                setAnswers({});
              }}
            >
              Réessayer
            </Button>
          )}
          <Button variant="outline" onClick={() => router.push('/kbs/exam/history')}>
            Historique
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {MOCK_EXAM.map((q, qi) => (
        <Card key={q.id}>
          <CardContent className="p-6">
            <p className="mb-4 text-sm font-semibold text-gray-900">
              <span className="mr-2 text-primary-500">Q{qi + 1}.</span>
              {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                  className={`w-full rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                    answers[q.id] === oi
                      ? 'border-primary-400 bg-primary-50 text-primary-700'
                      : 'border-border text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      <Button className="w-full" onClick={handleSubmit}>
        Soumettre l&apos;examen
      </Button>
    </div>
  );
};
