'use client';

import { useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getProofUploadUrl, recordReceipt } from '@/lib/actions/payments';
import { selectableChannels } from './channel-label';
import { ReceiptPicker } from './receipt-picker';
import { PAYMENT_CHANNELS } from '@kambriq/common/payments/payment-channels';
import type { PaymentReceipt } from '@/types/payments';

/**
 * Renders a form to record a payment receipt or correct an existing one.
 *
 * This form is responsible exclusively for recording receipts via `recordReceipt`.
 * It does not validate payments.
 *
 * It handles uploading the proof document to an S3 presigned URL first, then
 * submits the resulting key along with the receipt details. A proof file is required.
 *
 * For corrections: A negative amount reduces the total, and a positive amount adds to it.
 * Corrections require selecting an existing ledger line and providing a reason.
 * Corrections are appended as new entries; existing lines are never mutated.
 */
export const RecordReceiptForm = ({
  paymentId,
  currency,
  receipts,
}: {
  paymentId: string;
  currency: string;
  /** The ledger as it stands, so a correction can point at a line on it. */
  receipts: PaymentReceipt[];
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState<string>('VIR');
  const [receivedAt, setReceivedAt] = useState('');
  const [note, setNote] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [correctsId, setCorrectsId] = useState('');
  const [proofKey, setProofKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCorrection = correctsId !== '';

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
        paidBy: paidBy.trim() || undefined,
        correctsId: correctsId || undefined,
      });
      if (!res.success) {
        setError(res.error ?? "L'encaissement a été refusé.");
        return;
      }
      setAmount('');
      setNote('');
      setCorrectsId('');
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

        {/* Shown only when there is an existing line to correct. The target line is selected visually. */}
        {receipts.length > 0 && (
          <ReceiptPicker
            receipts={receipts}
            value={correctsId}
            onChange={setCorrectsId}
            label="Cette ligne corrige un encaissement existant"
            emptyLabel="Non — nouvel encaissement"
            hint="Une correction s'ajoute au journal : la ligne corrigée reste telle quelle. Montant négatif pour retirer du total, positif pour ajouter ce qui manquait."
            testId="corrects-id"
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">
              Montant ({currency}, entier{isCorrection ? ', signé' : ''})
            </span>
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d-]/g, ''))}
              className="w-full rounded border px-2 py-1"
              placeholder={isCorrection ? '-250000' : '250000'}
              data-testid="receipt-amount"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Canal</span>
            <select
              className="w-full rounded border px-3 py-2"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              {/* Options are restricted to the API registry subset. 'HIST' is excluded. */}
              {selectableChannels.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
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
              data-testid="receipt-received-at"
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
              data-testid="receipt-proof"
            />
            {uploading && <span className="text-xs text-gray-500">Téléversement…</span>}
            {proofKey && <span className="text-xs text-green-700">Justificatif téléversé.</span>}
            {isCorrection && (
              <span className="mt-1 block text-xs text-gray-400">
                Pour une correction : la pièce qui montre l&apos;erreur (relevé, confirmation).
              </span>
            )}
          </label>
        </div>

        {/* Rendered only for channels that support third-party payers. */}
        {PAYMENT_CHANNELS[channel as keyof typeof PAYMENT_CHANNELS]?.payerMayDiffer && (
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Versé par (obligatoire)</span>
            <input
              className="w-full rounded border px-3 py-2"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              placeholder="Nom figurant sur le bordereau de versement"
            />
            <span className="mt-1 block text-xs text-gray-500">
              Un dépôt au guichet est souvent fait par un proche. Sans ce nom, le bordereau ne peut
              pas être rattaché au paiement.
            </span>
          </label>
        )}

        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">
            {isCorrection ? 'Motif de la correction (obligatoire)' : 'Note (facultatif)'}
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded border px-2 py-1"
            placeholder={isCorrection ? 'Montant saisi deux fois' : undefined}
            data-testid="receipt-note"
          />
        </label>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <Button
          type="button"
          onClick={submit}
          disabled={
            pending ||
            uploading ||
            !proofKey ||
            !amount ||
            !receivedAt ||
            (isCorrection && note.trim() === '')
          }
          data-testid="record-receipt-submit"
        >
          {pending
            ? 'Enregistrement…'
            : isCorrection
              ? 'Enregistrer la correction'
              : "Enregistrer l'encaissement"}
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
