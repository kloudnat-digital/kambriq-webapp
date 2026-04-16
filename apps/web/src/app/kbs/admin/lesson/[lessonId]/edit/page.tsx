'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

import Navbar from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function LessonEditPage({ params }: { params: { lessonId: string } }) {
  const [title, setTitle] = useState('Introduction au marché foncier camerounais');
  const [content, setContent] = useState('Contenu de la leçon...');
  const [type, setType] = useState('video');
  const [duration, setDuration] = useState('15');

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <div className="mx-auto max-w-2xl px-6 py-10 sm:px-8">
          <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
            <Link href={`/kbs/admin/lesson/${params.lessonId}`}>
              <ArrowLeft className="size-4" /> Détail leçon
            </Link>
          </Button>
          <h1 className="mb-8 text-xl font-bold">Modifier la leçon</h1>
          <div className="space-y-5 rounded-2xl border border-border bg-white p-8 shadow-sm">
            <div className="space-y-1.5">
              <Label>Titre *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Vidéo</SelectItem>
                    <SelectItem value="text">Texte</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Durée (min)</Label>
                <Input
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Contenu / Description</Label>
              <Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
            <Button onClick={() => toast.success('Leçon mise à jour')}>
              <Save className="size-4" /> Sauvegarder
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
