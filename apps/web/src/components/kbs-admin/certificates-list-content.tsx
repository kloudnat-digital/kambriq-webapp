'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/kbs';
import type { AdminCertificate } from '@/types/kbs';

interface Props {
  rows: AdminCertificate[];
  meta: { total: number; totalPages: number; page: number; limit: number };
}

export const CertificatesListContent = ({ rows, meta }: Props) => {
  const t = useTranslations('app.adminKbs.certificates');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const goPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    startTransition(() => router.push(`?${params.toString()}`));
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      </header>
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">{t('empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs tracking-wide text-gray-500 uppercase">
                    <th className="px-4 py-3">{t('columns.kcaNumber')}</th>
                    <th className="px-4 py-3">{t('columns.candidate')}</th>
                    <th className="px-4 py-3">{t('columns.issueDate')}</th>
                    <th className="px-4 py-3">{t('columns.validUntil')}</th>
                    <th className="px-4 py-3">{t('columns.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-900">{c.kcaNumber}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {c.candidate.firstName} {c.candidate.lastName}
                        <p className="text-xs text-gray-500">{c.candidate.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(c.issueDate)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(c.validUntil)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            c.revokedAt
                              ? 'inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800'
                              : 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800'
                          }
                        >
                          {c.revokedAt ? t('statusRevoked') : t('statusActive')}
                        </span>
                      </td>
                    </tr>
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
                  onClick={() => goPage(meta.page - 1)}
                >
                  ‹
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.totalPages || pending}
                  onClick={() => goPage(meta.page + 1)}
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
