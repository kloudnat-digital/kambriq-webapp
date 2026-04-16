import Link from 'next/link';
import { ArrowLeft, Clock, BookOpen } from 'lucide-react';

import Navbar from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';

// In production this would fetch from the API by slug
export default function KnowledgeArticlePage({ params }: { params: { slug: string } }) {
  return (
    <>
      <Navbar />
      <main className="pt-[73px]">
        <div className="mx-auto max-w-3xl px-6 py-14 sm:px-8">
          <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
            <Link href="/knowledge-base">
              <ArrowLeft className="size-4" />
              Base de connaissances
            </Link>
          </Button>

          <div className="mb-6 flex items-center gap-3 text-sm text-gray-400">
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" /> 5 min de lecture
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="size-4" /> Lands
            </span>
          </div>

          <h1 className="mb-6 text-3xl font-bold text-gray-900">
            Article: {params.slug.replace(/-/g, ' ')}
          </h1>

          <div className="prose prose-gray max-w-none text-sm leading-relaxed text-gray-600">
            <p>
              Contenu de l&apos;article à venir. Cet article sera chargé depuis l&apos;API lors de
              l&apos;intégration backend.
            </p>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
              incididunt ut labore et dolore magna aliqua.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
