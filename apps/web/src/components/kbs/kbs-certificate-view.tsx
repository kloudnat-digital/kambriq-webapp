'use client';

import { useTranslations } from 'next-intl';
import { Award, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/kbs';
import type { MyCertificate } from '@/types/kbs';

interface Props {
  certificate: MyCertificate | null;
}

export const KbsCertificateView = ({ certificate }: Props) => {
  const t = useTranslations('app.kbs.certificate');

  if (!certificate) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-gray-500">{t('notYet')}</CardContent>
      </Card>
    );
  }

  const revoked = Boolean(certificate.revokedAt);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm">
        <div className="bg-gradient-to-r from-primary/90 to-primary px-6 py-5 text-primary-foreground">
          <div className="flex items-center gap-3">
            <Award className="size-7 text-amber-300" />
            <div>
              <p className="text-[11px] font-medium tracking-widest uppercase opacity-80">
                {t('pageTitle')}
              </p>
              <p className="text-base font-bold">KAMBRIQ Business School</p>
            </div>
          </div>
        </div>
        <div className="space-y-6 px-8 py-10 text-center">
          <p className="text-xs tracking-wide text-gray-400 uppercase">KCA</p>
          <p className="text-3xl font-bold text-gray-900">
            {certificate.candidate.firstName} {certificate.candidate.lastName}
          </p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <Field label={t('kcaNumber')} value={certificate.kcaNumber} mono />
            <Field
              label={t('finalScore')}
              value={certificate.finalScore != null ? `${certificate.finalScore}%` : '—'}
            />
            <Field
              label={t('modulesCompleted')}
              value={`${certificate.modulesCompleted}/${certificate.modulesTotal}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-amber-100 pt-4 text-sm">
            <Field label={t('issueDate')} value={formatDate(certificate.issueDate)} />
            <Field label={t('validUntil')} value={formatDate(certificate.validUntil)} />
          </div>
        </div>
      </div>

      {revoked && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {t('revoked')}
        </div>
      )}

      {certificate.pdfUrl && !revoked && (
        <div className="flex justify-center">
          <Button asChild>
            <a href={certificate.pdfUrl} target="_blank" rel="noreferrer" className="gap-2">
              <Download className="size-4" />
              {t('downloadPdf')}
            </a>
          </Button>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <p className="text-xs text-gray-400">{label}</p>
    <p className={`mt-0.5 font-semibold text-gray-900 ${mono ? 'font-mono text-sm' : ''}`}>
      {value}
    </p>
  </div>
);
