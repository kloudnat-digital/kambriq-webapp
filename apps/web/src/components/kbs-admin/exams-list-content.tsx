'use client';

import { Fragment, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { KBS_EXAM_TONE, formatDateTime } from '@/lib/kbs';
import { useToastStore } from '@/store/toast.store';
import { adminCancelExam } from '@/lib/actions/kbs';
import type { AdminExamRow, KbsExamStatus } from '@/types/kbs';

interface Props {
  rows: AdminExamRow[];
  meta: { total: number; totalPages: number; page: number; limit: number };
  initialStatus: string;
}

const STATUSES: KbsExamStatus[] = [
  'SCHEDULED',
  'IN_PROGRESS',
  'SUBMITTED',
  'PASSED',
  'FAILED',
  'CANCELLED',
];

export const ExamsListContent = ({ rows, meta, initialStatus }: Props) => {
  const t = useTranslations('app.adminKbs.exams');
  const { createToast } = useToastStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const apply = (next: { status?: string; page?: number }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.status !== undefined) {
      if (next.status) params.set('status', next.status);
      else params.delete('status');
    }
    params.set('page', String(next.page ?? 1));
    startTransition(() => router.push(`?${params.toString()}`));
  };

  const cancel = (examId: string) => {
    if (!reason.trim()) return;
    startTransition(async () => {
      const res = await adminCancelExam(examId, reason.trim(), pathname);
      if (!res.success) return createToast({ status: 'error', title: res.error });
      setCancelling(null);
      setReason('');
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>
            <select
              value={initialStatus}
              onChange={(e) => apply({ status: e.target.value })}
              className="rounded-md border border-input bg-white px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">{t('empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs tracking-wide text-gray-500 uppercase">
                    <th className="px-4 py-3">{t('columns.candidate')}</th>
                    <th className="px-4 py-3">{t('columns.attempt')}</th>
                    <th className="px-4 py-3">{t('columns.status')}</th>
                    <th className="px-4 py-3">{t('columns.score')}</th>
                    <th className="px-4 py-3">{t('columns.scheduledAt')}</th>
                    <th className="px-4 py-3 text-right">{t('columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <Fragment key={e.id}>
                      <tr className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{e.candidateName}</td>
                        <td className="px-4 py-3">{e.attemptNumber}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              KBS_EXAM_TONE[e.status],
                            )}
                          >
                            {e.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">{e.score != null ? `${e.score}%` : '—'}</td>
                        <td className="px-4 py-3">
                          {formatDateTime(e.submittedAt ?? e.scheduledAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(e.status === 'SCHEDULED' || e.status === 'IN_PROGRESS') && (
                            <Button variant="ghost" size="sm" onClick={() => setCancelling(e.id)}>
                              <XCircle className="size-4 text-red-600" />
                            </Button>
                          )}
                        </td>
                      </tr>
                      {cancelling === e.id && (
                        <tr>
                          <td colSpan={6} className="bg-gray-50 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Input
                                value={reason}
                                onChange={(ev) => setReason(ev.target.value)}
                                placeholder={t('cancelReason')}
                                className="flex-1"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCancelling(null)}
                              >
                                Close
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => cancel(e.id)}
                                disabled={pending || !reason.trim()}
                              >
                                {t('cancel')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
              <span>
                {meta.page} / {meta.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1 || pending}
                  onClick={() => apply({ page: meta.page - 1 })}
                >
                  ‹
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.totalPages || pending}
                  onClick={() => apply({ page: meta.page + 1 })}
                >
                  ›
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
