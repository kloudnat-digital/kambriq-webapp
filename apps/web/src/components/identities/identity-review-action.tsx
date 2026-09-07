'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { reviewIdentity } from '@/lib/actions/payments';

/**
 * Approve or reject one identity, having looked at the document.
 *
 * A rejection requires a reason, which the API enforces and the client is told.
 * "Verified" is the word that releases bank coordinates to this person, so the
 * control says so rather than reading as filing.
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
    // Says what was refused and why. A control that goes quiet on refusal is
    // the silent mechanism A10-A12 exist to remove.
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
