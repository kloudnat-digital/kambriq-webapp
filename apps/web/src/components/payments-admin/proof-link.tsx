'use client';

import { useState } from 'react';
import { getProofDownloadUrl } from '@/lib/actions/payments';

/**
 * Renders a link to access the proof associated with a specific ledger entry.
 *
 * Fetches a short-lived signed URL for a private S3 object on demand to prevent
 * access issues and avoid caching signed URLs in the DOM.
 */
export const ProofLink = ({ paymentId, receiptId }: { paymentId: string; receiptId: string }) => {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  const open = async () => {
    setState('loading');
    const res = await getProofDownloadUrl({ paymentId, receiptId });
    if (!res.success) {
      // Sets an error state if the URL request fails.
      setState('error');
      return;
    }
    setState('idle');
    window.open(res.data.downloadUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={state === 'loading'}
      className="text-emerald-700 underline underline-offset-2 hover:text-emerald-900 disabled:opacity-50"
    >
      {state === 'loading'
        ? 'Ouverture…'
        : state === 'error'
          ? 'Justificatif indisponible — réessayer'
          : 'Ouvrir le justificatif'}
    </button>
  );
};
