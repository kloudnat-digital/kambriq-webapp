'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import Navbar from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type AppStatus = 'draft' | 'pending' | 'approved' | 'rejected';

const STATUS_CONFIG: Record<AppStatus, { label: string; style: string; message: string }> = {
  draft: { label: 'Brouillon', style: 'border-gray-200 bg-gray-50 text-gray-600', message: '' },
  pending: {
    label: 'En attente',
    style: 'border-amber-300 bg-amber-50 text-amber-700',
    message: 'Votre candidature est en cours de révision. Nous vous contacterons sous 48h.',
  },
  approved: {
    label: 'Approuvé',
    style: 'border-success/30 bg-success/10 text-success',
    message: 'Félicitations ! Votre candidature a été approuvée. Bienvenue dans KAMNET™ !',
  },
  rejected: {
    label: 'Rejeté',
    style: 'border-red-300 bg-red-50 text-red-700',
    message:
      "Votre candidature n'a pas été retenue. Vous pouvez repostuler après avoir complété la formation KBS.",
  },
};

export default function KamnetApplyPage() {
  const [status] = useState<AppStatus>('draft');
  const [saving, setSaving] = useState(false);

  const { label, style, message } = STATUS_CONFIG[status];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    toast.success('Candidature soumise !');
    setSaving(false);
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50/50 pt-18.25">
        <div className="mx-auto max-w-xl px-6 py-14 sm:px-8">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Candidature KAMNET™</h1>
            <Badge className={style}>{label}</Badge>
          </div>

          {message && (
            <div className={`mb-6 rounded-xl border p-4 text-sm ${style}`}>{message}</div>
          )}

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
              <Input type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone / WhatsApp *</Label>
              <Input type="tel" required placeholder="+237 6 XX XX XX XX" />
            </div>
            <div className="space-y-1.5">
              <Label>Adresse de résidence *</Label>
              <Input required />
            </div>
            <div className="space-y-1.5">
              <Label>Code de parrainage (optionnel)</Label>
              <Input placeholder="KCA-XXXX-XXXX" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>
                Motivation * <span className="text-xs text-gray-400">(50-1000 caractères)</span>
              </Label>
              <Textarea rows={5} required minLength={50} maxLength={1000} />
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? 'Envoi…' : 'Soumettre'}
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
