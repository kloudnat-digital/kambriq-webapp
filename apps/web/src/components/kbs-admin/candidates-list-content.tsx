'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, Search } from 'lucide-react';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { KBS_STATUS_TONE, formatDate } from '@/lib/kbs';
import type { AdminCandidateRow, KbsCandidateStatus } from '@/types/kbs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface Props {
  rows: AdminCandidateRow[];
  meta: { total: number; totalPages: number; page: number; limit: number };
}

const STATUSES: KbsCandidateStatus[] = [
  'CANDIDATE',
  'IN_TRAINING',
  'EXAM_PENDING',
  'CERTIFIED',
  'FAILED',
];

export const CandidatesListContent = ({ rows, meta }: Props) => {
  const t = useTranslations('app.adminKbs.candidates');
  const tStatus = useTranslations('app.kbs.status');

  const [{ search, status }, setQuery] = useQueryStates(
    {
      search: parseAsString.withDefault(''),
      status: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
    },
    { shallow: false },
  );

  const [searchInput, setSearchInput] = useState(search);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-55 flex-1">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setQuery({ search: searchInput, page: 1 })}
                  placeholder={t('search')}
                  className="pl-8"
                />
              </div>
              <Select value={status} onValueChange={(v) => setQuery({ status: v, page: 1 })}>
                <SelectTrigger className="w-full max-w-48">
                  <SelectValue placeholder={t('filterStatus')} />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {tStatus(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size={'lg'} onClick={() => setQuery({ search: searchInput, page: 1 })}>
                {t('search')}
              </Button>
            </div>
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
                    <th className="px-4 py-3">{t('columns.name')}</th>
                    <th className="px-4 py-3">{t('columns.email')}</th>
                    <th className="px-4 py-3">{t('columns.status')}</th>
                    <th className="px-4 py-3">{t('columns.enrolledAt')}</th>
                    <th className="px-4 py-3 text-right">
                      <span className="sr-only">{t('columns.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {c.firstName} {c.lastName}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            KBS_STATUS_TONE[c.status],
                          )}
                        >
                          {tStatus(c.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(c.enrolledAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/admin/kbs/candidates/${c.id}`} className="gap-1">
                            <ExternalLink className="size-4" />
                          </Link>
                        </Button>
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
                {meta.page} / {meta.totalPages} · {meta.total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => setQuery({ page: meta.page - 1 })}
                >
                  ‹
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setQuery({ page: meta.page + 1 })}
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
