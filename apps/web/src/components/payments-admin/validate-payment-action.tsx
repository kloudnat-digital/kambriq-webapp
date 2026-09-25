'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Money } from './payment-money';
import { ReceiptPicker } from './receipt-picker';
import { validatePayment } from '@/lib/actions/payments';
import type { PaymentReceipt } from '@/types/payments';

/**
 * Renders a control for payment validation.
 *
 * Validation commits money, which serves as a prerequisite for downstream operations
 * like sale, commission, and title processes. The control displays the received
 * amount, the outstanding amount, and links the action to the executing user.
 * A reason is required for validation.
 *
 * A validation requires a supporting receipt to establish proof of payment.
 * The user selects an existing receipt from the ledger. The API rejects
 * validations that lack a valid receipt reference or reference an external payment's receipt.
 *
 * This action specifically calls `validatePayment` and is strictly separate from receipt recording.
 */
export const ValidatePaymentAction = ({
  paymentId,
  currency,
  amountReceived,
  outstanding,
  canValidate,
  receipts,
}: {
  paymentId: string;
  currency: string;
  amountReceived: string;
  outstanding: string;
  canValidate: boolean;
  receipts: PaymentReceipt[];
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [evidenceReceiptId, setEvidenceReceiptId] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Uses `BigInt(0)` to prevent compile errors from `0n` literals in an ES2015 target.
  // Performs an exact comparison to avoid floating point precision issues.
  const stillOwed = BigInt(outstanding) > BigInt(0);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await validatePayment({ paymentId, reason, evidenceReceiptId });
      if (!res.success) {
        setError(res.error ?? 'La validation a été refusée.');
        return;
      }
      router.refresh();
    });
  };

  if (!canValidate) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-gray-500">
          La validation est réservée aux administrateurs globaux : c&apos;est l&apos;acte qui engage
          l&apos;argent.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="font-semibold text-gray-900">Valider le paiement</h2>

        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900">Ce que cette action engage :</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-900">
            <li>
              le paiement passe à <strong>VALIDÉ</strong> et cet état est définitif : une erreur se
              corrige en ajoutant un mouvement, jamais en revenant en arrière ;
            </li>
            <li>
              encaissé à ce jour : <Money amount={amountReceived} currency={currency} /> ;
            </li>
            <li>
              {stillOwed ? (
                <>
                  il resterait <Money amount={outstanding} currency={currency} /> à percevoir —
                  valider maintenant déclare que ce solde est accepté ;
                </>
              ) : (
                <>le solde est à zéro.</>
              )}
            </li>
            <li>
              votre nom, votre motif et la preuve retenue sont inscrits dans la piste d&apos;audit.
            </li>
          </ul>
        </div>

        {receipts.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucun encaissement au journal : une validation repose sur une preuve, et il n&apos;y en
            a pas encore.
          </p>
        ) : (
          <ReceiptPicker
            receipts={receipts}
            value={evidenceReceiptId}
            onChange={setEvidenceReceiptId}
            label="Preuve sur laquelle repose la validation"
            emptyLabel="— choisir l'encaissement —"
            hint="L'encaissement qui établit que la totalité est constatée et prouvée."
            required
            testId="validate-evidence"
          />
        )}

        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Motif (obligatoire)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded border px-2 py-1"
            placeholder="Reçus vérifiés contre le relevé bancaire"
            data-testid="validate-reason"
          />
        </label>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <Button
          type="button"
          onClick={submit}
          disabled={pending || !reason.trim() || !evidenceReceiptId}
          data-testid="validate-submit"
        >
          {pending ? 'Validation…' : 'Valider le paiement'}
        </Button>
      </CardContent>
    </Card>
  );
};
