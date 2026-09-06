'use client';

import { useState } from 'react';
import { getProofDownloadUrl } from '@/lib/actions/payments';

/**
 * Opens the proof behind one ledger line.
 *
 * The object is private in S3. There is no public URL to link to, so the link
 * has to ask the API for a short-lived signed one at the moment it is clicked -
 * a URL minted at render time would be stale by the time anybody used it, and
 * caching signed URLs in a page is how a private object becomes a shared one.
 *
 * This exists because the endpoint did. `getProofDownloadUrl` was written,
 * tested, and called by nothing: the ledger printed the S3 key as grey text and
 * a person auditing a payment could read the name of a document they could not
 * open. That is A10 in miniature - an API the product cannot reach - and the
 * whole reason the screen is inside this chantier.
 */
export const ProofLink = ({ paymentId, receiptId }: { paymentId: string; receiptId: string }) => {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  const open = async () => {
    setState('loading');
    const res = await getProofDownloadUrl({ paymentId, receiptId });
    if (!res.success) {
      // Says what failed. A link that quietly does nothing is the silent
      // mechanism A10-A12 exist to remove.
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
