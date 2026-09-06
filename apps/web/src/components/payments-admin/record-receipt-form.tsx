'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getProofUploadUrl, recordReceipt } from '@/lib/actions/payments';

const CHANNELS = [
  { value: 'VIREMENT', label: 'Virement bancaire' },
  { value: 'MOBILE_MONEY', label: 'Mobile money' },
  { value: 'ESPECES', label: 'Espèces' },
  { value: 'ACTE_NOTARIE', label: 'Acte notarié' },
] as const;

/**
 * Records one encaissement, with its proof.
 *
 * **This form cannot validate a payment.** It calls `recordReceipt` and
 * nothing else; validating is a separate action on a separate control, because
 * recording what arrived and agreeing that it settles the payment are two acts.
 *
 * The proof is uploaded first, to a presigned PUT, and only its key is sent
 * with the receipt. A receipt cannot be submitted without one - the button
 * stays disabled until a file has uploaded, the API refuses a blank
 * `evidenceUrl`, and the database `CHECK` refuses it after that.
 */
export const RecordReceiptForm = ({
  paymentId,
  currency,
}: {
  paymentId: string;
  currency: string;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState<string>('VIREMENT');
  const [receivedAt, setReceivedAt] = useState('');
  const [note, setNote] = useState('');
  const [proofKey, setProofKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (f: File) => {
    setUploading(true);
    setError(null);
    try {
      const res = await getProofUploadUrl({ paymentId, fileName: f.name, contentType: f.type });
      if (!res.success) throw new Error(res.error ?? 'upload url refused');
      const { uploadUrl, key } = res.data;
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        body: f,
        headers: { 'Content-Type': f.type },
      });
      if (!put.ok) throw new Error(`upload failed (${put.status})`);
      setProofKey(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Le téléversement a échoué.');
      setProofKey(null);
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    if (!proofKey) return;
    setError(null);
    startTransition(async () => {
      const res = await recordReceipt({
        paymentId,
        amount,
        currency,
        channel,
        receivedAt: new Date(receivedAt).toISOString(),
        evidenceUrl: proofKey,
        note: note || undefined,
      });
      if (!res.success) {
        setError(res.error ?? "L'encaissement a été refusé.");
        return;
      }
      setAmount('');
      setNote('');
      setProofKey(null);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="font-semibold text-gray-900">Enregistrer un encaissement</h2>
        <p className="text-xs text-gray-500">
          Enregistrer un encaissement ne valide pas le paiement. La validation est un acte distinct.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Montant ({currency}, entier)</span>
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d-]/g, ''))}
              className="w-full rounded border px-2 py-1"
              placeholder="250000"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Canal</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full rounded border px-2 py-1"
            >
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Date réelle de réception</span>
            <input
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              className="w-full rounded border px-2 py-1"
            />
            <span className="mt-1 block text-xs text-gray-400">
              La date où l&apos;argent est arrivé, pas la date de saisie.
            </span>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Justificatif (obligatoire)</span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/heic"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setProofKey(null);
                if (f) void upload(f);
              }}
              className="w-full text-xs"
            />
            {uploading && <span className="text-xs text-gray-500">Téléversement…</span>}
            {proofKey && <span className="text-xs text-green-700">Justificatif téléversé.</span>}
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">Note (facultatif)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded border px-2 py-1"
          />
        </label>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <Button
          type="button"
          onClick={submit}
          disabled={pending || uploading || !proofKey || !amount || !receivedAt}
          data-testid="record-receipt-submit"
        >
          {pending ? 'Enregistrement…' : "Enregistrer l'encaissement"}
        </Button>
        {!proofKey && (
          <p className="text-xs text-gray-500">
            Un encaissement sans justificatif est refusé : la preuve est ce qui tranche un litige.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
