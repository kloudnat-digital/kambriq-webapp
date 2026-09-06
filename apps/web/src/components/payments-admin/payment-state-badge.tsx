import type { PaymentState } from '@/types/payments';

/** The nine states, in French, with the colour a person reads them by. */
const LABELS: Record<PaymentState, { text: string; className: string }> = {
  INITIE: { text: 'Initié', className: 'bg-gray-100 text-gray-700' },
  INSTRUCTIONS_ENVOYEES: { text: 'Instructions envoyées', className: 'bg-blue-100 text-blue-800' },
  ANNONCE_CLIENT: { text: 'Annoncé par le client', className: 'bg-indigo-100 text-indigo-800' },
  EN_VERIFICATION: { text: 'En vérification', className: 'bg-amber-100 text-amber-800' },
  PARTIELLEMENT_RECU: { text: 'Partiellement reçu', className: 'bg-orange-100 text-orange-800' },
  VALIDE: { text: 'Validé', className: 'bg-green-100 text-green-800' },
  REJETE: { text: 'Rejeté', className: 'bg-red-100 text-red-800' },
  EXPIRE: { text: 'Expiré', className: 'bg-red-100 text-red-800' },
  ANNULE: { text: 'Annulé', className: 'bg-gray-200 text-gray-600' },
};

/** The same nine labels, for anything that needs the words without the badge. */
export const STATE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(LABELS).map(([state, l]) => [state, l.text]),
);

export const PaymentStateBadge = ({ state }: { state: PaymentState }) => {
  const l = LABELS[state];
  return (
    <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${l.className}`}>
      {l.text}
    </span>
  );
};
