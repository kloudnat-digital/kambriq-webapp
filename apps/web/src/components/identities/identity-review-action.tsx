'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { reviewIdentity } from '@/lib/actions/payments';

/**
 * Renders a control to approve or reject a submitted identity document.
 *
 * Approving an identity unlocks the ability to send bank coordinates to the client.
 * Rejecting an identity requires a valid reason, which is enforced by the API.
 */
export const IdentityReviewAction = ({ userId }: { userId: string }) => {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const review = async (status: 'verified' | 'rejected') => {
    setBusy(true);
    setError(null);
    const res = await reviewIdentity({
      userId,
      status,
      ...(status === 'rejected' ? { rejectionReason: reason } : {}),
    });
    setBusy(false);
    // Renders the error message if the review action fails.
    if (!res.success) setError(res.error ?? 'La décision a été refusée.');
    else router.push('/admin/identities');
  };

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4">
      <h2 className="font-semibold text-gray-900">Décision</h2>
      <p className="text-sm text-gray-600">
        Vérifier cette identité autorise l&apos;envoi des coordonnées de paiement à cette personne.
        C&apos;est la seule condition qui ouvre cette porte : ne la franchissez qu&apos;après avoir
        regardé la pièce.
      </p>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Motif (obligatoire pour un refus)</span>
        <input
          className="w-full rounded border px-3 py-2"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Pièce illisible, nom différent de celui de la réservation…"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => review('verified')}
          className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
        >
          Vérifier l&apos;identité
        </button>
        <button
          type="button"
          disabled={busy || reason.trim() === ''}
          onClick={() => review('rejected')}
          className="rounded border border-red-700 px-4 py-2 text-sm font-medium text-red-700 disabled:border-gray-300 disabled:text-gray-400"
          title={reason.trim() === '' ? 'Un refus doit dire pourquoi.' : undefined}
        >
          Refuser
        </button>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
};
