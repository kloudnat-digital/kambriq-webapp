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
 * Renders a control to transition the payment to its next legal state.
 *
 * Available transitions are defined by the state machine's transition table.
 * Excludes terminal states (REJETE, EXPIRE, ANNULE) and the VALIDE state, which
 * is handled by a separate dedicated control.
 *
 * Transitions into evidenced states require selecting a supporting receipt.
 * The API enforces this requirement.
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
    // Displays the error if the transition request fails.
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
