'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Search, Users } from 'lucide-react';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProspectRow } from './prospect-row';
import { ProspectForm } from './prospect-form';
import { ALL_STATUSES, LEAD_STATUSES } from './lead-status';
import type { Lead } from '@/types/kamnet';

/**
 * The prospect list, its filter, its search and its create control.
 *
 * Structure follows `candidates-list-content.tsx` - card, search input with an
 * Enter handler, a status select, a table that scrolls on its own, a pagination
 * footer. Its colours are NOT followed: that file carries twelve non-system
 * classes and `lib/kbs.ts` twenty-eight more behind its status map. Everything
 * here is a token.
 *
 * One deliberate divergence from that precedent: it has no all-statuses option,
 * so once an admin picks a status the filter cannot be cleared. `ALL_STATUSES`
 * is the sentinel that fixes it here, mapped by the page to no parameter.
 */

interface Props {
  rows: Lead[];
  meta: { total: number; totalPages: number; page: number; limit: number };
  /** True when a status or search term is active, so the empty copy can differ. */
  filtered: boolean;
}

export const ProspectsContent = ({ rows, meta, filtered }: Props) => {
  const t = useTranslations('app.prospects');

  const [{ search, status }, setQuery] = useQueryStates(
    {
      search: parseAsString.withDefault(''),
      status: parseAsString.withDefault(ALL_STATUSES),
      page: parseAsInteger.withDefault(1),
    },
    { shallow: false },
  );

  const [searchInput, setSearchInput] = useState(search);
  const [creating, setCreating] = useState(false);

  const applySearch = () => setQuery({ search: searchInput, page: 1 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            placeholder={t('search')}
            aria-label={t('search')}
            className="pl-8"
          />
        </div>

        <Select value={status} onValueChange={(v) => setQuery({ status: v, page: 1 })}>
          <SelectTrigger className="w-full max-w-52" aria-label={t('filterStatus')}>
            <SelectValue placeholder={t('filterStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>{t('allStatuses')}</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status.${s}` as never)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={applySearch} variant="outline">
          {t('search')}
        </Button>

        <Button data-lead-create onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          {t('create')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div
          data-prospects="empty"
          className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-20 text-center"
        >
          <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary-500/10">
            <Users className="size-8 text-primary-500" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t('emptyTitle')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {filtered ? t('emptyFiltered') : t('emptyMessage')}
          </p>
        </div>
      ) : (
        <div
          data-prospects="table"
          className="overflow-x-auto rounded-2xl border border-border bg-card"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-3">{t('columns.client')}</th>
                <th className="px-4 py-3">{t('columns.contact')}</th>
                <th className="px-4 py-3">{t('columns.source')}</th>
                <th className="px-4 py-3">{t('columns.status')}</th>
                <th className="px-4 py-3">{t('columns.createdAt')}</th>
                <th className="px-4 py-3 text-right">
                  <span className="sr-only">{t('columns.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => (
                <ProspectRow key={lead.id} lead={lead} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {meta.page} / {meta.totalPages} - {meta.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => setQuery({ page: meta.page - 1 })}
            >
              {'<'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => setQuery({ page: meta.page + 1 })}
            >
              {'>'}
            </Button>
          </div>
        </div>
      )}

      {creating && <ProspectForm mode="create" onClose={() => setCreating(false)} />}
    </div>
  );
};
