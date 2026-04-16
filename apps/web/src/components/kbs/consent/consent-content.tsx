'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, FileWarning, Lock, Scale, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ConsentRule } from './consent-rule';

const RULES = [
  {
    id: 'confidentiality',
    icon: Lock,
    title: 'Confidentialité du contenu',
    description:
      'Le contenu de la formation KBS est strictement confidentiel et réservé aux candidats inscrits. Toute divulgation est interdite.',
  },
  {
    id: 'noDuplication',
    icon: FileWarning,
    title: 'Interdiction de duplication',
    description:
      'Il est formellement interdit de reproduire ou dupliquer le contenu de la formation sous quelque forme que ce soit.',
    items: [
      "Captures d'écran des leçons",
      'Enregistrements vidéo ou audio',
      'Copie du texte des modules',
    ],
  },
  {
    id: 'noSharing',
    icon: AlertCircle,
    title: 'Partage interdit',
    description:
      "Vous ne pouvez pas partager vos identifiants de connexion ni permettre à une autre personne d'accéder à votre compte.",
  },
  {
    id: 'watermark',
    icon: CheckCircle2,
    title: 'Filigrane dynamique',
    description:
      "Tout le contenu est marqué avec vos informations personnelles. Toute copie sera traçable jusqu'à son auteur.",
  },
  {
    id: 'consequences',
    icon: ShieldAlert,
    title: 'Conséquences en cas de violation',
    description: 'Toute violation de ces règles entraînera des sanctions immédiates.',
    items: [
      'Suspension définitive du compte KBS',
      'Annulation de la certification KCA',
      'Poursuites judiciaires pour violation de la propriété intellectuelle',
    ],
    variant: 'destructive' as const,
  },
] as const;

export function ConsentContent() {
  const router = useRouter();
  const [accepted, setAccepted] = useState<Record<string, boolean>>({
    confidentiality: false,
    noDuplication: false,
    noSharing: false,
    watermark: false,
    consequences: false,
  });
  const [finalAccepted, setFinalAccepted] = useState(false);

  const allAccepted = Object.values(accepted).every(Boolean);

  const toggle = (key: string) => setAccepted((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSubmit = async () => {
    if (!allAccepted || !finalAccepted) {
      toast.error('Veuillez accepter toutes les conditions avant de continuer.');
      return;
    }
    await new Promise((r) => setTimeout(r, 800));
    toast.success('Consentement enregistré. Bienvenue dans la formation KBS !');
    setTimeout(() => router.push('/kbs/dashboard'), 1200);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="mb-10 text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
          <ShieldAlert className="size-4" />
          Accord de confidentialité
        </span>
        <h1 className="mb-3 text-3xl font-bold text-gray-900">
          Conditions d&apos;accès à la formation KBS
        </h1>
        <p className="text-gray-500">
          Veuillez lire et accepter chacune des conditions pour accéder aux modules de formation.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <span className="font-semibold">Important : </span>
        Ce consentement est obligatoire et sera enregistré avec votre adresse IP et horodatage.
      </div>

      <Card className="mb-6 border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="size-5 text-primary" />
            Règles à respecter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {RULES.map((rule) => (
            <ConsentRule
              key={rule.id}
              id={rule.id}
              checked={accepted[rule.id]}
              onCheck={() => toggle(rule.id)}
              icon={rule.icon}
              title={rule.title}
              description={rule.description}
              items={'items' in rule ? [...rule.items] : undefined}
              variant={'variant' in rule ? rule.variant : 'default'}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="mb-8 border-2 border-primary/30">
        <CardContent className="pt-6">
          <div
            className={`flex items-start gap-4 rounded-xl bg-primary/5 p-4 ${!allAccepted ? 'opacity-50' : ''}`}
          >
            <Checkbox
              id="final"
              checked={finalAccepted}
              onCheckedChange={(v) => setFinalAccepted(v as boolean)}
              disabled={!allAccepted}
            />
            <div>
              <Label htmlFor="final" className="cursor-pointer text-base font-bold text-gray-900">
                J&apos;accepte l&apos;ensemble des conditions ci-dessus
              </Label>
              <p className="mt-1 text-sm text-gray-500">
                En cochant cette case, je m&apos;engage à respecter ces règles pour toute la durée
                de ma formation.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button variant="outline" onClick={() => router.push('/products/kbs')}>
          Annuler
        </Button>
        <Button disabled={!allAccepted || !finalAccepted} onClick={handleSubmit}>
          <CheckCircle2 className="size-4" />
          Confirmer et accéder à la formation
        </Button>
      </div>

      <p className="mt-8 text-center text-xs text-gray-400">
        Ce consentement est enregistré de manière sécurisée conformément à notre politique de
        confidentialité.
      </p>
    </div>
  );
}
