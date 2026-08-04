'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { KBS_STATUS_TONE, formatDate, formatDateTime } from '@/lib/kbs';
import { useToastStore } from '@/store/toast.store';
import {
  adminIssueCertificate,
  adminResetAttempts,
  adminRevokeCertificate,
  adminUpdateCandidateStatus,
} from '@/lib/actions/kbs';
import type { AdminCandidateDetail, KbsCandidateStatus } from '@/types/kbs';

interface Props {
  candidate: AdminCandidateDetail;
}

const STATUSES: KbsCandidateStatus[] = [
  'CANDIDATE',
  'IN_TRAINING',
  'EXAM_PENDING',
  'CERTIFIED',
  'FAILED',
];

export const CandidateDetailContent = ({ candidate }: Props) => {
  const t = useTranslations('app.adminKbs.candidates.detail');
  const tStatus = useTranslations('app.kbs.status');
  const { createToast } = useToastStore();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [revokeReason, setRevokeReason] = useState('');

  const runStatus = (status: string) => {
    startTransition(async () => {
      const res = await adminUpdateCandidateStatus(candidate.id, status, pathname);
      if (!res.success) return createToast({ status: 'error', title: res.error });
      createToast({ status: 'success', title: t('updateStatus') });
      router.refresh();
    });
  };

  const runReset = () => {
    startTransition(async () => {
      const res = await adminResetAttempts(candidate.id, pathname);
      if (!res.success) return createToast({ status: 'error', title: res.error });
      createToast({ status: 'success', title: t('resetAttempts') });
      router.refresh();
    });
  };

  const runIssue = () => {
    startTransition(async () => {
      const res = await adminIssueCertificate(candidate.id, undefined, pathname);
      if (!res.success) return createToast({ status: 'error', title: res.error });
      createToast({ status: 'success', title: t('issueCertificate') });
      router.refresh();
    });
  };

  const runRevoke = () => {
    if (!revokeReason.trim()) return;
    startTransition(async () => {
      const res = await adminRevokeCertificate(candidate.id, revokeReason.trim(), pathname);
      if (!res.success) return createToast({ status: 'error', title: res.error });
      createToast({ status: 'success', title: t('revokeCertificate') });
      setRevokeReason('');
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/kbs/candidates"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="size-4" />
        {t('title')}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {candidate.firstName} {candidate.lastName}
          </h1>
          <p className="text-sm text-gray-500">{candidate.email}</p>
          {candidate.phone && <p className="text-xs text-gray-500">{candidate.phone}</p>}
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
            KBS_STATUS_TONE[candidate.status],
          )}
        >
          {tStatus(candidate.status)}
        </span>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('profile')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Info k="Enrolled" v={formatDate(candidate.enrolledAt)} />
            <Info k="Engagement" v={formatDateTime(candidate.engagementAcceptedAt)} />
            <Info k="Cycle" v={String(candidate.currentCycle)} />
            {candidate.sponsorCode && <Info k="Sponsor" v={candidate.sponsorCode} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('documents')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {candidate.idDocumentUrls.length === 0 && <p className="text-gray-500">—</p>}
            {candidate.idDocumentUrls.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <FileText className="size-4" /> ID document #{i + 1}
              </a>
            ))}
            {candidate.cvUrl && (
              <a
                href={candidate.cvUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <FileText className="size-4" /> CV
              </a>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('progress')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {candidate.progress.length === 0 ? (
            <p className="text-gray-500">—</p>
          ) : (
            candidate.progress.map((p) => (
              <div
                key={p.moduleId}
                className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0"
              >
                <span className="font-medium text-gray-900">
                  {p.moduleOrder}. {p.moduleTitle}
                </span>
                <span className={cn('text-xs', p.passed ? 'text-emerald-700' : 'text-gray-500')}>
                  {p.score != null ? `${p.score}%` : '—'} · {p.attempts} attempts
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('exams')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {candidate.exams.length === 0 ? (
            <p className="text-gray-500">—</p>
          ) : (
            candidate.exams.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0"
              >
                <span className="font-medium text-gray-900">Attempt {e.attemptNumber}</span>
                <span className="text-xs text-gray-500">
                  {e.status} · {e.score != null ? `${e.score}%` : '—'} ·{' '}
                  {formatDateTime(e.submittedAt ?? e.scheduledAt)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('updateStatus')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <Button
                key={s}
                variant={s === candidate.status ? 'default' : 'outline'}
                size="sm"
                disabled={pending || s === candidate.status}
                onClick={() => runStatus(s)}
              >
                {tStatus(s)}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={runReset} disabled={pending}>
              {pending && <Spinner className="size-4" />}
              {t('resetAttempts')}
            </Button>
            {!candidate.certificate && (
              <Button size="sm" onClick={runIssue} disabled={pending}>
                {pending && <Spinner className="size-4" />}
                {t('issueCertificate')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {candidate.certificate && !candidate.certificate.revokedAt && (
        <Card>
          <CardHeader>
            <CardTitle>{t('revokeCertificate')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Input
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Reason"
              className="min-w-[220px] flex-1"
            />
            <Button
              variant="destructive"
              onClick={runRevoke}
              disabled={pending || !revokeReason.trim()}
            >
              {t('revokeCertificate')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const Info = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
    <span className="text-gray-500">{k}</span>
    <span className="font-medium text-gray-900">{v}</span>
  </div>
);
