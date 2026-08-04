'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, FileText, UploadCloud, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useToastStore } from '@/store/toast.store';
import { enrollKbs, getCvUploadUrl, getIdUploadUrl, submitIdDocuments } from '@/lib/actions/kbs';
import { Alert } from '../ui/alert';

type UploadedFile = { name: string; fileUrl: string };

const uploadToS3 = async (uploadUrl: string, file: File): Promise<void> => {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
};

export const KbsEnrollForm = () => {
  const t = useTranslations('app.kbs.enroll');
  const { createToast } = useToastStore();
  const { update } = useSession();

  const idInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const [idFiles, setIdFiles] = useState<UploadedFile[]>([]);
  const [cv, setCv] = useState<UploadedFile | null>(null);
  const [sponsor, setSponsor] = useState('');
  const [engagement, setEngagement] = useState(false);
  const [idUploading, setIdUploading] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const idRes = await submitIdDocuments(idFiles.map((f) => f.fileUrl));
      if (!idRes.success) throw new Error(idRes.error || t('error'));
      const enrollRes = await enrollKbs({
        sponsorCode: sponsor.trim() || undefined,
        cvUrl: cv?.fileUrl,
        engagementAccepted: true,
      });
      if (!enrollRes.success) throw new Error(enrollRes.error || t('error'));
    },
    onSuccess: async () => {
      createToast({ status: 'success', title: t('success') });
      await update();
      window.location.assign('/kbs');
    },
    onError: (err) => {
      createToast({ status: 'error', title: err.message });
    },
  });

  const handleIdSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIdUploading(true);
    try {
      const res = await getIdUploadUrl({ filename: file.name, contentType: file.type });
      if (!res.success) throw new Error(res.error);
      await uploadToS3(res.data.uploadUrl, file);
      setIdFiles((prev) => [...prev, { name: file.name, fileUrl: res.data.fileUrl }]);
      createToast({ status: 'success', title: t('idAdded') });
    } catch (err) {
      createToast({
        status: 'error',
        title: err instanceof Error ? err.message : t('error'),
      });
    } finally {
      setIdUploading(false);
    }
  };

  const handleCvSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCvUploading(true);
    try {
      const res = await getCvUploadUrl({ filename: file.name, contentType: file.type });
      if (!res.success) throw new Error(res.error);
      await uploadToS3(res.data.uploadUrl, file);
      setCv({ name: file.name, fileUrl: res.data.fileUrl });
      createToast({ status: 'success', title: t('cvAdded') });
    } catch (err) {
      createToast({
        status: 'error',
        title: err instanceof Error ? err.message : t('error'),
      });
    } finally {
      setCvUploading(false);
    }
  };

  const removeIdFile = (fileUrl: string) => {
    setIdFiles((prev) => prev.filter((f) => f.fileUrl !== fileUrl));
  };

  const submitDisabled =
    idFiles.length === 0 || !engagement || idUploading || cvUploading || isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('pageTitle')}</CardTitle>
        <p className="text-sm text-gray-500">{t('intro')}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-900">{t('idSection')}</p>
            <p className="text-xs text-gray-500">{t('idHelp')}</p>
          </div>
          <input
            ref={idInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleIdSelect}
          />
          <Button
            type="button"
            variant="outline"
            disabled={idUploading}
            className="gap-2"
            onClick={() => idInputRef.current?.click()}
          >
            {idUploading ? <Spinner className="size-4" /> : <UploadCloud className="size-4" />}
            {t('idButton')}
          </Button>
          {idFiles.length > 0 && (
            <ul className="space-y-1.5">
              {idFiles.map((f) => (
                <li
                  key={f.fileUrl}
                  className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                >
                  <FileText className="size-4 text-gray-500" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => removeIdFile(f.fileUrl)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-900">{t('cvSection')}</p>
            <p className="text-xs text-gray-500">{t('cvHelp')}</p>
          </div>
          <input
            ref={cvInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleCvSelect}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => cvInputRef.current?.click()}
            disabled={cvUploading}
            className="gap-2"
          >
            {cvUploading ? <Spinner className="size-4" /> : <UploadCloud className="size-4" />}
            {t('cvButton')}
          </Button>
          {cv && (
            <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
              <FileText className="size-4 text-gray-500" />
              <span className="flex-1 truncate">{cv.name}</span>
              <button
                type="button"
                onClick={() => setCv(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <Field>
            <FieldLabel htmlFor="sponsor">{t('sponsorSection')}</FieldLabel>
            <Input
              id="sponsor"
              value={sponsor}
              onChange={(e) => setSponsor(e.target.value)}
              placeholder={t('sponsorPlaceholder')}
            />
          </Field>
        </section>

        <section className="space-y-2">
          <Alert>
            Paiement: 249€ hors plateforme. Les instructions de paiement vous seront envoyées par
            email.
          </Alert>
        </section>

        <section className="space-y-2">
          <p className="text-sm font-medium text-gray-900">{t('engagementSection')}</p>
          <Field orientation="horizontal" className="items-start gap-3">
            <Checkbox
              id="engagement"
              checked={engagement}
              onCheckedChange={(v) => setEngagement(v === true)}
            />
            <label
              htmlFor="engagement"
              className="cursor-pointer text-sm leading-snug text-gray-700"
            >
              {t('engagementText')}
            </label>
          </Field>
        </section>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
          {idFiles.length > 0 && engagement && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
              <CheckCircle2 className="size-4" /> {t('idAdded')}
            </span>
          )}
          <Button type="button" onClick={() => mutate()} disabled={submitDisabled}>
            {isPending && <Spinner className="size-4" />}
            {isPending ? t('submitting') : t('submit')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
