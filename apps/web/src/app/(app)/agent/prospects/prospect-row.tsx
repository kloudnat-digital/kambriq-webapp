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
 * One prospect, its status, the moves it may make, and its edit and delete
 * controls.
 *
 * ---------------------------------------------------------------------------
 * Why only some moves are offered
 * ---------------------------------------------------------------------------
 * `transitionsFrom` reads `KAMNET_VALID_LEAD_TRANSITIONS`, the same table
 * `leads.service.update` enforces. A button the server would refuse with a 400
 * is worse than no button: the agent learns the screen lies. `CONVERTED` has an
 * empty list, so a converted prospect is offered no move at all, and a status
 * outside the five is offered none either.
 *
 * This is presentation, not a guard. The server decides; the screen simply does
 * not offer what it would refuse.
 *
 * ---------------------------------------------------------------------------
 * A limitation of the endpoint, visible here
 * ---------------------------------------------------------------------------
 * `leads.service.update` nests its entire write inside
 * `if (dto.status && dto.status !== lead.status)`. An edit that does not change
 * the status therefore writes nothing and returns `undefined`, while answering
 * success. The edit form below is built on the endpoint as it is; the defect is
 * reported as its own subject rather than fixed here, because this step must
 * not touch the API.
 */

/**
 * The five the catalogue carries a label for.
 *
 * Declared above the component on purpose: `const` is not hoisted, so a
 * reference from the render body to a declaration further down the file is a
 * temporal-dead-zone error at module evaluation, not a style question.
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
            {/* A status outside the five renders its raw value rather than an
                empty pill, so an operator sees that something is wrong. */}
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
