import type { PaymentPurpose } from '@/types/payments';

/** What a payment pays for (G20), in the back office's French. */
const LABELS: Record<PaymentPurpose, { text: string; className: string }> = {
  ACOMPTE: { text: 'Acompte', className: 'bg-sky-50 text-sky-800 ring-sky-200' },
  SOLDE: { text: 'Solde', className: 'bg-violet-50 text-violet-800 ring-violet-200' },
};

/**
 * Deposit or balance. One reservation carries both, with the same client, the
 * same parcel and close amounts; without this a person validating one could not
 * tell which. An unknown value is shown raw rather than guessed.
 */
export const PaymentPurposeLabel = ({ purpose }: { purpose: PaymentPurpose }) => {
  const l = LABELS[purpose];
  if (!l) return <span className="font-mono text-xs">{purpose}</span>;
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${l.className}`}
    >
      {l.text}
    </span>
  );
};
