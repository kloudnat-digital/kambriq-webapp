import Link from 'next/link';
import { ArrowLeft, PlayCircle, FileText, CheckCircle, Lock } from 'lucide-react';

import Navbar from '@/components/layout/navbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const LESSONS = [
  {
    id: 'l1',
    title: 'Introduction au marché foncier camerounais',
    duration: '15 min',
    completed: true,
    type: 'video',
  },
  {
    id: 'l2',
    title: 'Les acteurs du marché immobilier',
    duration: '20 min',
    completed: true,
    type: 'video',
  },
  {
    id: 'l3',
    title: 'Cadre légal et réglementaire',
    duration: '25 min',
    completed: true,
    type: 'text',
  },
  {
    id: 'l4',
    title: 'Les types de propriété foncière',
    duration: '18 min',
    completed: false,
    type: 'video',
  },
  { id: 'l5', title: 'Évaluation foncière', duration: '22 min', completed: false, type: 'text' },
  {
    id: 'l6',
    title: 'Quiz de validation',
    duration: '10 min',
    completed: false,
    type: 'quiz',
    locked: true,
  },
];

export default function ModuleViewPage({ params }: { params: { moduleId: string } }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <div className="mx-auto max-w-4xl px-6 py-10 sm:px-8">
          <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
            <Link href="/kbs/dashboard">
              <ArrowLeft className="size-4" /> Dashboard
            </Link>
          </Button>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-sm font-medium text-primary-600">Module {params.moduleId}</p>
              <h1 className="text-2xl font-bold text-gray-900">
                Fondamentaux du marché foncier camerounais
              </h1>
            </div>
            <Button asChild variant="outline">
              <Link href={`/kbs/module/${params.moduleId}/detail`}>Vue d&apos;ensemble</Link>
            </Button>
          </div>

          {/* Progress */}
          <div className="mb-8 rounded-2xl border border-border bg-white p-5">
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-gray-500">3/6 leçons terminées</span>
              <span className="font-medium">50%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full w-1/2 rounded-full bg-primary-500" />
            </div>
          </div>

          {/* Lessons */}
          <div className="space-y-3">
            {LESSONS.map((lesson) => (
              <Card key={lesson.id} className={lesson.locked ? 'opacity-60' : ''}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                    {lesson.locked ? (
                      <Lock className="size-4 text-gray-400" />
                    ) : lesson.type === 'video' ? (
                      <PlayCircle
                        className={`size-4 ${lesson.completed ? 'text-success' : 'text-primary-600'}`}
                      />
                    ) : (
                      <FileText
                        className={`size-4 ${lesson.completed ? 'text-success' : 'text-amber-600'}`}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{lesson.title}</p>
                    <p className="text-xs text-gray-400">{lesson.duration}</p>
                  </div>
                  {lesson.completed && <CheckCircle className="size-5 text-success" />}
                  {!lesson.completed && !lesson.locked && (
                    <Badge variant="outline" className="text-xs">
                      À faire
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 flex gap-3">
            <Button className="flex-1">Continuer la leçon 4</Button>
            <Button asChild variant="outline">
              <Link href={`/kbs/revision/${params.moduleId}`}>Réviser</Link>
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
