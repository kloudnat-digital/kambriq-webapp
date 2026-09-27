'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { getIdUploadUrl, submitIdDocuments } from '@/lib/actions/identity';
import { uploadToS3 } from '@/lib/storage/upload-to-s3';

type Status = 'none' | 'pending' | 'verified' | 'rejected';

/**
 * Asks the signed-in person for their identity document where a flow needs it
 * (I47: the payment page). Uploads to the presigned URL, then submits the
 * storage key; once submitted, the document waits for the back office's review.
 */
export const IdentityDocumentUpload = ({ status }: { status: Status }) => {
  const t = useTranslations('myPayment.identity');
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(status === 'pending');
  const [error, setError] = useState<string | null>(null);

  if (status === 'verified') return null;
  if (sent) {
    return (
      <p className="mt-3 text-sm text-gray-700" data-testid="identity-sent">
        {t('sent')}
      </p>
    );
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const url = await getIdUploadUrl({ filename: file.name, contentType: file.type });
      if (!url.success) throw new Error(url.error);
      await uploadToS3(url.data.uploadUrl, file);
      const submitted = await submitIdDocuments([url.data.fileUrl]);
      if (!submitted.success) throw new Error(submitted.error);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {status === 'rejected' && (
        <p className="text-sm text-red-700" data-testid="identity-rejected">
          {t('rejected')}
        </p>
      )}
      <p className="text-xs text-gray-500">{t('help')}</p>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={onFile}
        data-testid="identity-file"
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        className="gap-2"
        onClick={() => input.current?.click()}
      >
        {busy ? <Spinner className="size-4" /> : <UploadCloud className="size-4" />}
        {t('button')}
      </Button>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
};
