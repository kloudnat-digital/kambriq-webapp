'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { sendInstructions } from '@/lib/actions/payments';
import { ChannelLabel, selectableChannels } from './channel-label';
import { HumanDate } from './payment-money';
import type { EmailDeliveryIssue, PaymentChannel } from '@/types/payments';

/**
 * Renders the control for releasing payment instructions.
 *
 * Implements requirement v03 4c: The client's preferred channel is displayed
 * for context but must not be pre-selected in the UI. This forces a deliberate
 * channel assignment by the operator.
 *
 * Requires a rationale for the channel choice to maintain audit trail fidelity
 * (capturing who, when, what channel, and why).
 *
 * C26: shows what SES reported about the client's address. The coordinates are
 * published on the client's space and the email only announces them, so a dead
 * mailbox does not misdirect money; it means the client is not told while the
 * 30-day period starts. A permanent bounce or a complaint therefore requires the
 * operator to confirm the client was told another way; a transient bounce is
 * shown without a gate. Nothing here can correct the address, so the send is
 * never blocked outright.
 */

/** A permanent bounce or a complaint: mail to this address does not arrive. */
export const isUndeliverable = (issue: EmailDeliveryIssue | null): boolean =>
  !!issue && (issue.kind === 'COMPLAINT' || issue.type === 'Permanent');

export const SendInstructionsAction = ({
  paymentId,
  preferredChannel,
  identityVerified,
  identityStatus,
  clientUserId,
  emailDelivery = null,
}: {
  paymentId: string;
  preferredChannel: PaymentChannel | null;
  identityVerified: boolean;
  identityStatus: string;
  clientUserId: string | null;
  emailDelivery?: EmailDeliveryIssue | null;
}) => {
  const router = useRouter();
  const [channel, setChannel] = useState<string>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toldOtherwise, setToldOtherwise] = useState(false);
  const undeliverable = isUndeliverable(emailDelivery);

  const send = async () => {
    setBusy(true);
    setError(null);
    const res = await sendInstructions({ paymentId, channel, reason });
    setBusy(false);
    if (!res.success) setError(res.error ?? "L'envoi a été refusé.");
    else router.refresh();
  };

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4">
      <h2 className="font-semibold text-gray-900">Répondre au client</h2>

      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
        <p className="font-medium text-amber-900">Ce que cette action engage :</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-amber-900">
          <li>
            les coordonnées du <strong>seul canal choisi</strong> sont publiées sur l&apos;espace du
            client, derrière son authentification ;
          </li>
          <li>
            l&apos;email qu&apos;il reçoit dit qu&apos;elles sont disponibles et ne les contient pas
            ;
          </li>
          <li>
            le paiement passe à <strong>INSTRUCTIONS_ENVOYÉES</strong> et le délai de 30 jours
            démarre ;
          </li>
          <li>votre nom, le canal et votre motif sont inscrits dans la piste d&apos;audit.</li>
        </ul>
      </div>

      {emailDelivery && undeliverable && (
        <div
          data-testid="email-undeliverable"
          className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900"
        >
          <p className="font-medium">
            {emailDelivery.kind === 'COMPLAINT' ? (
              <>
                Ce client a signalé nos emails comme indésirables le{' '}
                <HumanDate at={emailDelivery.occurredAt} />.
              </>
            ) : (
              <>
                L&apos;adresse email de ce client est rejetée définitivement depuis le{' '}
                <HumanDate at={emailDelivery.occurredAt} /> ({emailDelivery.type ?? ''}/
                {emailDelivery.subType ?? ''}).
              </>
            )}
          </p>
          <p className="mt-1">
            Il ne sera pas prévenu par email que les coordonnées sont disponibles, et le délai de 30
            jours démarrera quand même. Prévenez-le par un autre moyen avant de publier.
          </p>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              data-testid="told-otherwise"
              checked={toldOtherwise}
              onChange={(e) => setToldOtherwise(e.target.checked)}
            />
            <span>J&apos;ai prévenu le client par un autre moyen.</span>
          </label>
        </div>
      )}

      {emailDelivery && !undeliverable && (
        <div
          data-testid="email-uncertain"
          className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Un email à ce client a été refusé temporairement le{' '}
          <HumanDate at={emailDelivery.occurredAt} />. Il peut arriver en retard.
        </div>
      )}

      {!identityVerified ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-medium">
            L&apos;identité de ce client n&apos;est pas vérifiée ({identityStatus}).
          </p>
          <p className="mt-1">
            Les coordonnées bancaires ne sortent que vers quelqu&apos;un que nous avons reconnu.
            {clientUserId && (
              <>
                {' '}
                <a
                  href={`/admin/identities/${clientUserId}`}
                  className="underline underline-offset-2"
                >
                  Examiner sa pièce d&apos;identité
                </a>
                .
              </>
            )}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            Souhait du client :{' '}
            <span className="font-semibold">
              <ChannelLabel channel={preferredChannel} withCode />
            </span>
            {preferredChannel && ' — à prendre en compte, sans vous lier.'}
          </p>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Canal retenu</span>
            <select
              className="w-full rounded border px-3 py-2"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              {/* No default: choosing is the act. */}
              <option value="">— choisir —</option>
              {selectableChannels.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Motif (obligatoire)</span>
            <input
              className="w-full rounded border px-3 py-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Client bancarisé, virement convenu au téléphone"
            />
          </label>

          <button
            type="button"
            disabled={
              busy || channel === '' || reason.trim() === '' || (undeliverable && !toldOtherwise)
            }
            onClick={send}
            className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
          >
            {busy ? 'Envoi…' : 'Publier les coordonnées et notifier'}
          </button>
        </>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
};
