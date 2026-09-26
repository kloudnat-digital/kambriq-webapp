'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { requestPaymentAction, setPreferredChannelAction } from '@/lib/actions/lands';
import { Money } from '@/components/payments-admin/payment-money';
import { selectableChannels } from '@/components/payments-admin/channel-label';
import { Link } from '@/i18n/navigation';

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
  purpose = 'ACOMPTE',
  expected,
}: {
  reservationId: string;
  amountDue: number;
  currency?: string;
  /** Which payment the card asks for; the server decides which one is due (G20). */
  purpose?: 'ACOMPTE' | 'SOLDE';
  /** The balance announced at reservation, shown beside what is actually owed when they differ. */
  expected?: number;
}) => {
  const t = useTranslations('myPayment');
  const r = useTranslations('myPayment.request');
  const [payment, setPayment] = useState<Created | null>(null);
  const [preferred, setPreferred] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      setError(null);
      const res = await requestPaymentAction(reservationId);
      // Says what went wrong. A button that quietly does nothing is the silent
      // mechanism A10-A12 exist to remove.
      if (!res.success) throw new Error(res.error ?? r('refused'));
      return res.data as Created;
    },
    onSuccess: (p) => setPayment(p),
    onError: (e: Error) => setError(e.message),
  });

  const savePreference = useMutation({
    mutationFn: async ({ paymentId, channel }: { paymentId: string; channel: string }) => {
      setError(null);
      const res = await setPreferredChannelAction(paymentId, channel || null);
      if (!res.success) throw new Error(res.error ?? r('preferenceNotSaved'));
      return res.data;
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="font-semibold text-gray-900">
        {purpose === 'SOLDE' ? r('balanceTitle') : r('title')}
      </h3>

      {!payment ? (
        <>
          <p className="mt-1 text-sm text-gray-600">
            {r('amountLabel')}{' '}
            <span className="font-semibold">
              {/* `downPaymentAmount` is the quarantined Float; rounded to the
                  whole franc exactly as the API rounds it when it creates the
                  payment, so the figure here and the figure on the reference
                  cannot disagree. */}
              <Money amount={String(Math.round(amountDue))} currency={currency} />
            </span>
            . {r('notOnline')}
          </p>
          {expected !== undefined && Math.round(expected) !== Math.round(amountDue) && (
            <p className="mt-1 text-sm text-amber-800">
              {r('balanceDiffers')}{' '}
              <Money amount={String(Math.round(expected))} currency={currency} />
            </p>
          )}
          <button
            type="button"
            disabled={create.isPending}
            onClick={() => create.mutate()}
            className="mt-3 rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
          >
            {create.isPending ? r('creating') : r('create')}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-gray-600">{r('recorded')}</p>
          <p className="mt-3 font-mono text-2xl font-bold tracking-wider text-gray-900">
            {payment.reference}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {r('amount')} <Money amount={payment.amountDue} currency={payment.currency} />
          </p>

          {/* v03 4c: the client states what suits them. It binds nothing, and
              the card says so - a control that implied otherwise would be a
              decision taken before the identification, which is the wrong
              place. */}
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium">{r('preferenceLabel')}</span>
            <select
              className="w-full rounded border px-3 py-2"
              value={preferred}
              onChange={(e) => {
                setPreferred(e.target.value);
                savePreference.mutate({ paymentId: payment.id, channel: e.target.value });
              }}
            >
              <option value="">{r('noPreference')}</option>
              {selectableChannels.map((c) => (
                <option key={c.code} value={c.code}>
                  {t(`channels.${c.code}` as 'channels.VIR')}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-gray-500">{r('preferenceHelp')}</span>
          </label>

          <Link
            href={`/mylands/payment/${payment.id}`}
            className="mt-3 inline-block rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
          >
            {r('follow')}
          </Link>
        </>
      )}

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
};
