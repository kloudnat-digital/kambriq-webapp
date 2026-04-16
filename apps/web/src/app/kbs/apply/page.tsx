'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import Navbar from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function KbsApplyPage() {
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    toast.success('Candidature soumise avec succès !');
    setSaving(false);
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-[73px]">
        <div className="mx-auto max-w-xl px-6 py-14 sm:px-8">
          <h1 className="mb-2 text-2xl font-bold">Candidature KBS</h1>
          <p className="mb-8 text-sm text-gray-500">
            Remplissez ce formulaire pour rejoindre la KAMBRIQ Business School.
          </p>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-2xl border border-border bg-white p-8 shadow-sm"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Prénom *</Label>
                <Input required placeholder="Jean" />
              </div>
              <div className="space-y-1.5">
                <Label>Nom *</Label>
                <Input required placeholder="Dupont" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" required placeholder="jean@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone / WhatsApp *</Label>
              <Input type="tel" required placeholder="+237 6 XX XX XX XX" />
            </div>
            <div className="space-y-1.5">
              <Label>Pays de résidence *</Label>
              <Input required placeholder="France, Canada, Cameroun…" />
            </div>
            <div className="space-y-1.5">
              <Label>Code de parrainage (optionnel)</Label>
              <Input placeholder="KCA-XXXX-XXXX" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>
                Motivation * <span className="text-xs text-gray-400">(50-1000 caractères)</span>
              </Label>
              <Textarea
                rows={5}
                required
                minLength={50}
                maxLength={1000}
                placeholder="Pourquoi souhaitez-vous rejoindre la KBS et devenir agent KCA ?"
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? 'Envoi…' : 'Soumettre ma candidature'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => toast.info('Brouillon sauvegardé')}
              >
                Brouillon
              </Button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
