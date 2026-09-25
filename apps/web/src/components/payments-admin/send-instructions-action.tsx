'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { sendInstructions } from '@/lib/actions/payments';
import { ChannelLabel, selectableChannels } from './channel-label';
import type { PaymentChannel } from '@/types/payments';

/**
 * G13 - the back office chooses the channel and releases the coordinates.
 *
 * ---------------------------------------------------------------------------
 * The preference is beside the choice, never inside it
 * ---------------------------------------------------------------------------
 * v03 4c asks for the client's wish to be visible and to bind nothing. So it is
 * shown, plainly, next to the six options - and **nothing is preselected**. A
 * control that arrives with the preference already chosen makes accepting it the
 * path of least resistance, which is a decision taken by the interface rather
 * than by the person.
 *
 * The reason is required, because the transition records "qui, quand, quel
 * canal, et pourquoi" and the why is a human's: the amount, the country the
 * funds come from, what was agreed on the telephone.
 */
export const SendInstructionsAction = ({
  paymentId,
  preferredChannel,
  identityVerified,
  identityStatus,
  clientUserId,
}: {
  paymentId: string;
  preferredChannel: PaymentChannel | null;
  identityVerified: boolean;
  identityStatus: string;
  clientUserId: string | null;
}) => {
  const router = useRouter();
  const [channel, setChannel] = useState<string>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
            disabled={busy || channel === '' || reason.trim() === ''}
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
