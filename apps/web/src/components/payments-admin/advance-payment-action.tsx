'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { transitionPayment } from '@/lib/actions/payments';
import {
  PAYMENT_TRANSITIONS,
  COMMITTING_STATES,
  EVIDENCED_STATES,
} from '@kambriq/common/payments/payment-state';
import { STATE_LABELS } from './payment-state-badge';
import { ReceiptPicker } from './receipt-picker';
import type { PaymentReceipt } from '@/types/payments';

/**
 * Moves the payment one legal step.
 *
 * **The steps offered come from the transition table itself**, not from a list
 * typed here. A screen with its own idea of what is legal disagrees with the
 * state machine the first time either changes, and the operator is the one who
 * finds out - by pressing a button that returns an error.
 *
 * `VALIDE` is excluded because it has its own control, which states what it
 * commits before it commits it. The terminal exits (rejeté, expiré, annulé) are
 * excluded too: ending a payment is not "advancing" it and does not belong
 * behind the same button as bookkeeping.
 *
 * **A step into `EVIDENCED_STATES` names the receipt it rests on** (G7). The
 * picker appears only when one of the offered steps needs it, and that step's
 * button stays disabled until a line is chosen - the same set the API's guard
 * reads, so the screen cannot offer a step the API will refuse for lack of
 * evidence. The other steps send nothing and the audit row says NULL.
 */
export const AdvancePaymentAction = ({
  paymentId,
  state,
  isGlobalAdmin,
  receipts,
}: {
  paymentId: string;
  state: string;
  isGlobalAdmin: boolean;
  receipts: PaymentReceipt[];
}) => {
  const [reason, setReason] = useState('');
  const [evidenceReceiptId, setEvidenceReceiptId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = (PAYMENT_TRANSITIONS[state as keyof typeof PAYMENT_TRANSITIONS] ?? []).filter(
    (s) => !['VALIDE', 'REJETE', 'EXPIRE', 'ANNULE'].includes(s) && s !== state,
  );
  if (next.length === 0) return null;

  const someStepNeedsEvidence = next.some((s) => EVIDENCED_STATES.has(s));

  const move = async (to: string) => {
    setBusy(true);
    setError(null);
    const needsEvidence = EVIDENCED_STATES.has(to as never);
    const res = await transitionPayment({
      paymentId,
      to,
      reason,
      evidenceReceiptId: needsEvidence ? evidenceReceiptId : undefined,
    });
    setBusy(false);
    // Says which step was refused and why. A control that goes quiet on refusal
    // is the silent mechanism A10-A12 exist to remove.
    if (!res.success) setError(res.error ?? `Le passage à ${to} a été refusé.`);
    else {
      setReason('');
      setEvidenceReceiptId('');
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="font-semibold text-gray-900">Faire avancer le paiement</h2>
        <p className="text-sm text-gray-600">
          Chaque étape est un acte nommé, avec son motif, inscrit dans la piste d&apos;audit. Cette
          action déplace l&apos;état et ne touche à aucun montant.
        </p>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Motif (obligatoire)</span>
          <input
            className="w-full rounded border px-3 py-2"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Le client a annoncé son virement"
            data-testid="advance-reason"
          />
        </label>

        {someStepNeedsEvidence &&
          (receipts.length === 0 ? (
            <p className="text-sm text-gray-500">
              Constater un encaissement repose sur une preuve : enregistrez d&apos;abord
              l&apos;encaissement au journal.
            </p>
          ) : (
            <ReceiptPicker
              receipts={receipts}
              value={evidenceReceiptId}
              onChange={setEvidenceReceiptId}
              label="Preuve sur laquelle repose l'étape"
              emptyLabel="— choisir l'encaissement —"
              hint="Requise pour constater un montant reçu. Les autres étapes n'en portent pas."
              required
              testId="advance-evidence"
            />
          ))}

        <div className="flex flex-wrap gap-2">
          {next.map((to) => {
            const commits = COMMITTING_STATES.has(to);
            const needsEvidence = EVIDENCED_STATES.has(to);
            const blocked = commits && !isGlobalAdmin;
            return (
              <button
                key={to}
                type="button"
                disabled={
                  busy || reason.trim() === '' || blocked || (needsEvidence && !evidenceReceiptId)
                }
                onClick={() => move(to)}
                className="rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:bg-gray-300"
                title={
                  blocked
                    ? 'Cet état engage l’argent : réservé aux administrateurs globaux.'
                    : needsEvidence && !evidenceReceiptId
                      ? 'Choisissez l’encaissement sur lequel repose cette étape.'
                      : undefined
                }
                data-testid={`advance-to-${to}`}
              >
                Passer à {STATE_LABELS[to] ?? to}
                {commits && ' (engage l’argent)'}
              </button>
            );
          })}
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
      </CardContent>
    </Card>
  );
};
