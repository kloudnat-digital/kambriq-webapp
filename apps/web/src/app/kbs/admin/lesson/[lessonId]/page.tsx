import Link from 'next/link';
import { ArrowLeft, Pencil, PlayCircle } from 'lucide-react';

import Navbar from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function LessonDetailPage({ params }: { params: { lessonId: string } }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <div className="mx-auto max-w-3xl px-6 py-10 sm:px-8">
          <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
            <Link href="/kbs/admin">
              <ArrowLeft className="size-4" /> Admin KBS
            </Link>
          </Button>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <Badge variant="outline" className="mb-2 text-xs">
                Module 1 · Leçon {params.lessonId}
              </Badge>
              <h1 className="text-xl font-bold">Introduction au marché foncier camerounais</h1>
            </div>
            <Button asChild>
              <Link href={`/kbs/admin/lesson/${params.lessonId}/edit`}>
                <Pencil className="size-4" /> Modifier
              </Link>
            </Button>
          </div>
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <PlayCircle className="size-5 text-primary-600" />
              <span className="text-sm font-medium">Vidéo · 15 min</span>
            </div>
            <div className="mb-4 flex aspect-video w-full items-center justify-center rounded-xl bg-gray-900">
              <PlayCircle className="size-16 text-gray-600" />
            </div>
            <h2 className="mb-3 text-base font-semibold">Contenu de la leçon</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              Cette leçon introduit les fondamentaux du marché foncier camerounais, les acteurs, le
              cadre légal et les opportunités pour la diaspora.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
