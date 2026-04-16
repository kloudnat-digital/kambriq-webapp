'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';

import Navbar from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function ModuleEditPage({ params }: { params: { moduleId: string } }) {
  const [title, setTitle] = useState('Fondamentaux du marché foncier camerounais');
  const [description, setDescription] = useState('Ce module couvre les bases du marché foncier.');

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
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-xl font-bold">Modifier le module {params.moduleId}</h1>
            <Button asChild variant="outline" size="sm">
              <Link href={`/kbs/admin/lesson/new`}>
                <Plus className="size-4" /> Ajouter une leçon
              </Link>
            </Button>
          </div>
          <div className="space-y-5 rounded-2xl border border-border bg-white p-8 shadow-sm">
            <div className="space-y-1.5">
              <Label>Titre du module</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button onClick={() => toast.success('Module mis à jour')}>
              <Pencil className="size-4" /> Sauvegarder
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
