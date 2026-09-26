'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/store/toast.store';
import { updateLead } from '@/lib/actions/kamnet';
import { ProspectForm } from './prospect-form';
import { ProspectDeleteDialog } from './prospect-delete-dialog';
import { toneFor, transitionsFrom } from './lead-status';
import type { Lead } from '@/types/kamnet';

/**
 * Renders a single prospect row, including status transitions and management controls.
 *
 * Status transitions are filtered based on `KAMNET_VALID_LEAD_TRANSITIONS` to ensure
 * UI parity with API constraints (e.g., `CONVERTED` prospects cannot transition further).
 *
 * Note: The API's `leads.service.update` only processes writes if the status changes.
 * This component's edit form works around this endpoint behavior without altering the API.
 */

/**
 * Supported lead statuses with localized labels.
 * Declared here to ensure initialization before use within the component.
 */
const LABELLED = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];

const formatDate = (iso: string, locale = 'fr-FR'): string => {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const ProspectRow = ({ lead }: { lead: Lead }) => {
  const t = useTranslations('app.prospects');
  const { createToast } = useToastStore();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const moves = transitionsFrom(lead.status);

  const move = (to: string) =>
    startTransition(async () => {
      const result = await updateLead(
        lead.id,
        { status: to as Lead['status'] },
        '/agent/prospects',
      );
      createToast(
        result.success
          ? { status: 'success', title: t('updated') }
          : { status: 'error', title: result.error ?? t('failed') },
      );
    });

  return (
    <>
      <tr className="border-b border-border last:border-0 hover:bg-muted/50">
        <td className="px-4 py-3 font-medium text-foreground">{lead.clientName}</td>
        <td className="px-4 py-3 text-muted-foreground">
          <div>{lead.clientEmail}</div>
          <div className="text-xs">{lead.clientPhone}</div>
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {lead.source ? t(`source.${lead.source}` as never) : '-'}
        </td>
        <td className="px-4 py-3">
          <span
            data-lead-status={lead.status}
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
              toneFor(lead.status),
            )}
          >
            {/* Renders the raw status string if it falls outside the predefined valid states. */}
            {LABELLED.includes(lead.status) ? t(`status.${lead.status}` as never) : lead.status}
          </span>
        </td>
        <td className="px-4 py-3 text-muted-foreground tabular-nums">
          {formatDate(lead.createdAt)}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            {moves.map((to) => (
              <Button
                key={to}
                data-lead-transition={to}
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => move(to)}
              >
                {t('moveTo')} {t(`status.${to}` as never)}
              </Button>
            ))}
            <Button
              data-lead-edit
              variant="ghost"
              size="sm"
              aria-label={t('edit')}
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              data-lead-delete
              variant="ghost"
              size="sm"
              aria-label={t('delete')}
              onClick={() => setDeleting(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </td>
      </tr>

      {editing && <ProspectForm mode="edit" lead={lead} onClose={() => setEditing(false)} />}
      {deleting && <ProspectDeleteDialog lead={lead} onClose={() => setDeleting(false)} />}
    </>
  );
};
