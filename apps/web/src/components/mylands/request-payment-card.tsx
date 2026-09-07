'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { requestPaymentAction, sendMyInstructionsAction } from '@/lib/actions/lands';
import { Money } from '@/components/payments-admin/payment-money';

type Created = { id: string; reference: string; amountDue: string; currency: string };

/**
 * G9 - where a payment comes from.
 *
 * The design gives `INITIE` a "Qui le declenche" of **"Le client, sur la
 * plateforme"**, and its architecture reads "Le client declenche, la plateforme
 * instruit". This is that button.
 *
 * Before it existed, this page told the client they owed an acompte, showed them
 * the amount, and gave them nothing to press.
 *
 * **Two acts, deliberately.** Asking for the payment produces the reference and
 * puts it on screen. Emailing the instructions is a second, separate request -
 * so a failed send never costs the client their reference, and they can ask
 * again without creating a second payment.
 *
 * **One money formatter, `<Money>`, for both amounts shown here.** The rest of
 * this page uses `formatXAF`, which appends "FCFA" - so the first draft of this
 * card said "400 000 FCFA" before the payment existed and "400 000 XAF" after,
 * the same amount rendered two ways in one card. That is the "750 000 FCFA XAF"
 * defect in miniature. The divergence between the two on the wider mylands
 * surface is recorded in the register rather than half-fixed here.
 */
export const RequestPaymentCard = ({
  reservationId,
  amountDue,
  currency = 'XAF',
}: {
  reservationId: string;
  amountDue: number;
  currency?: string;
}) => {
  const [payment, setPayment] = useState<Created | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      setError(null);
      const res = await requestPaymentAction(reservationId);
      // Says what went wrong. A button that quietly does nothing is the silent
      // mechanism A10-A12 exist to remove.
      if (!res.success) throw new Error(res.error ?? 'La demande a été refusée.');
      return res.data as Created;
    },
    onSuccess: (p) => setPayment(p),
    onError: (e: Error) => setError(e.message),
  });

  const send = useMutation({
    mutationFn: async (paymentId: string) => {
      setError(null);
      const res = await sendMyInstructionsAction(paymentId);
      if (!res.success) throw new Error(res.error ?? "L'envoi a échoué.");
      return res.data;
    },
    onSuccess: () => setSent(true),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="font-semibold text-gray-900">Régler l&apos;acompte</h3>

      {!payment ? (
        <>
          <p className="mt-1 text-sm text-gray-600">
            Montant à régler :{' '}
            <span className="font-semibold">
              {/* `downPaymentAmount` is the quarantined Float; rounded to the
                  whole franc exactly as the API rounds it when it creates the
                  payment, so the figure here and the figure on the reference
                  cannot disagree. */}
              <Money amount={String(Math.round(amountDue))} currency={currency} />
            </span>
            . KAMBRIQ n&apos;encaisse pas en ligne : vous recevrez une référence à indiquer sur
            votre virement, votre paiement mobile money ou chez le notaire.
          </p>
          <button
            type="button"
            disabled={create.isPending}
            onClick={() => create.mutate()}
            className="mt-3 rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
          >
            {create.isPending ? 'Création…' : 'Obtenir ma référence de paiement'}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-gray-600">
            Indiquez cette référence comme motif de votre paiement, quel que soit le canal.
          </p>
          <p className="mt-3 font-mono text-2xl font-bold tracking-wider text-gray-900">
            {payment.reference}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Montant : <Money amount={payment.amountDue} currency={payment.currency} />
          </p>

          <button
            type="button"
            disabled={send.isPending || sent}
            onClick={() => send.mutate(payment.id)}
            className="mt-3 rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
          >
            {sent
              ? 'Instructions envoyées par email'
              : send.isPending
                ? 'Envoi…'
                : 'Recevoir les instructions par email'}
          </button>

          {/* The reference is on screen already, so an email that never arrives
              is an inconvenience rather than a dead end. */}
          <p className="mt-2 text-xs text-gray-500">
            Votre référence est valable même si vous ne recevez pas l&apos;email.
          </p>
        </>
      )}

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
};
