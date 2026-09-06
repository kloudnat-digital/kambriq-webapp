'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Money } from './payment-money';
import { validatePayment } from '@/lib/actions/payments';

/**
 * Validating a payment, and saying what it commits before it is pressed.
 *
 * Validation is the act that commits money: everything downstream - the sale,
 * the commission, the title - rests on it. So the control states the amount
 * received, the amount still outstanding, and that the act is recorded against
 * the person pressing it. A reason is required, and the button stays disabled
 * without one.
 *
 * This is a **different action** from recording. It calls `validatePayment` and
 * nothing else.
 */
export const ValidatePaymentAction = ({
  paymentId,
  currency,
  amountReceived,
  outstanding,
  canValidate,
}: {
  paymentId: string;
  currency: string;
  amountReceived: string;
  outstanding: string;
  canValidate: boolean;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // `BigInt(0)` rather than the `0n` literal: the web inherits target es2015
  // from the base tsconfig, which rejects BigInt literals, and Next rewrites
  // this file on dev start so a target override there would not survive. The
  // comparison is still exact - the amount is never parsed into a Number,
  // because a monetary value in a JavaScript number is the Float defect G1
  // removed from the schema.
  const stillOwed = BigInt(outstanding) > BigInt(0);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await validatePayment({ paymentId, reason });
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
            <li>votre nom et votre motif sont inscrits dans la piste d&apos;audit.</li>
          </ul>
        </div>

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
          disabled={pending || !reason.trim()}
          data-testid="validate-submit"
        >
          {pending ? 'Validation…' : 'Valider le paiement'}
        </Button>
      </CardContent>
    </Card>
  );
};
