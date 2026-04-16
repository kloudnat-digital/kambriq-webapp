import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'reserved', label: 'Réservation', desc: 'Terrain réservé par votre agent' },
  { key: 'downPayment', label: 'Validation acompte', desc: 'Acompte de 5% confirmé par KAMBRIQ' },
  { key: 'documents', label: 'Signature documents', desc: 'Vos pièces reçues et validées' },
  { key: 'remainingPayment', label: 'Paiements restants', desc: 'Solde du prix confirmé' },
  { key: 'dossier', label: 'Avancement dossier', desc: 'Transfert de propriété en cours' },
  { key: 'completed', label: 'Livraison documents finaux', desc: 'Titre foncier à votre nom' },
] as const;

interface JourneyStepsProps {
  reservation: {
    status: string;
    createdAt: string;
    confirmedAt: string | null;
    documentsReceivedAt: string | null;
    remainingPaymentConfirmedAt: string | null;
    dossierStartedAt: string | null;
    completedAt: string | null;
  };
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function JourneySteps({ reservation: r }: JourneyStepsProps) {
  const dates: Record<string, string | null> = {
    reserved: r.createdAt,
    downPayment: r.confirmedAt,
    documents: r.documentsReceivedAt,
    remainingPayment: r.remainingPaymentConfirmedAt,
    dossier: r.dossierStartedAt,
    completed: r.completedAt,
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-base font-semibold text-gray-900">Suivi de votre achat</h2>
      <ol className="relative space-y-0">
        {STEPS.map((step, idx) => {
          const date = dates[step.key];
          const done = !!date;
          const isLast = idx === STEPS.length - 1;
          const isCurrent = !done && !!dates[STEPS[idx - 1]?.key ?? ''];

          return (
            <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Vertical line */}
              {!isLast && (
                <div
                  className={cn(
                    'absolute top-8 bottom-0 left-[15px] w-0.5',
                    done ? 'bg-primary' : 'bg-gray-200',
                  )}
                />
              )}

              {/* Icon */}
              <div className="relative z-10 shrink-0">
                {done ? (
                  <CheckCircle2 className="size-8 text-primary" />
                ) : isCurrent ? (
                  <Clock className="size-8 text-amber-500" />
                ) : (
                  <Circle className="size-8 text-gray-300" />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn('text-sm font-semibold', done ? 'text-gray-900' : 'text-gray-400')}
                >
                  {step.label}
                </p>
                <p className={cn('text-xs', done ? 'text-gray-500' : 'text-gray-300')}>
                  {done ? (formatDate(date) ?? step.desc) : step.desc}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
